// @ts-nocheck
import React from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Radio } from "@shared/components/ui/Radio";
import { useState, useEffect } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { createPaymentRequest } from "@shared/lib/edge/paymentRequestsClient";
import { fetchContactsForOwner } from "@shared/api/services/supabaseService";

interface ContactSelectModalProps {
  closeModal: () => void;
  amount: string;
  setToSendData: any;
  method: "Request" | "Send";
}

interface Contact {
  value: string;
  label: string;
  id: number;
  state: string;
}

const ContactSelectModal = ({ setToSendData, closeModal, amount, method }: ContactSelectModalProps) => {
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  // activeTab can be "all" or "my"
  const [activeTab, setActiveTab] = useState<"all" | "my">("my");

  const { userData } = useAuth();


  useEffect(() => {
    async function fetchContacts() {
      if (!userData?.cubidData?.id) return;
      try {
        const data = await fetchContactsForOwner(userData.cubidData.id);
        const mappedContacts = data.map((connection) => ({
          value: String(connection.id),
          label: connection.full_name ?? connection.username ?? "Unknown contact",
          id: Number(connection.id),
          state: connection.state ?? "added",
        }));

        const validContacts = mappedContacts.filter((contact: Contact) => contact.state !== "rejected");

        setContacts(validContacts);
        if (validContacts.length > 0) {
          setSelectedContact(validContacts[0].value);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    }
    fetchContacts();
  }, [userData]);

  // Filter by search term
  const filteredContacts = contacts.filter((contact) =>
    contact.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separate contacts into tabs:
  // "All Contacts" will show contacts with state "new".
  // "My Contacts" will show the remaining valid contacts.
  const allContacts = filteredContacts.filter(contact => contact.state === "new");
  const myContacts = filteredContacts.filter(contact => contact.state !== "new");

  const contactsToDisplay = activeTab === "all" ? allContacts : myContacts;

  return (
    <div className="mt-2 p-0">
      {/* Tabs */}
      <div className="mb-4 flex">
        <button
          type="button"
          className={`flex-1 py-2 ${activeTab === "all" ? "border-b-2 border-blue-500" : "text-gray-500"}`}
          onClick={() => setActiveTab("all")}
        >
          All Contacts
        </button>
        <button
          type="button"
          className={`flex-1 py-2 ${activeTab === "my" ? "border-b-2 border-blue-500" : "text-gray-500"}`}
          onClick={() => setActiveTab("my")}
        >
          My Contacts
        </button>
      </div>
      <div className="space-y-4">
        {contactsToDisplay.length > 5 && (
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        )}

        {contactsToDisplay.length > 0 ? (
          contactsToDisplay.map((contact) => (
            <Radio
              name="contact-selection"
              key={contact.id}
              label={contact.label}
              value={contact.value}
              onValueChange={(val) => {
                setSelectedContact(val)
              }}
              id={`contact-${contact.id}`}
              defaultChecked={contact.value === selectedContact}
            />
          ))
        ) : (
          <p>No contacts found.</p>
        )}

        <Button
          className="w-full"
          disabled={!selectedContact}
          onClick={async () => {
            if (method === "Send") {
              setToSendData(selectedContact);
            }
            if (method === "Request") {
              function extractDecimalFromString(str: string): number {
                const match = str.match(/-?\d+(\.\d+)?/);
                return match ? Number(match[0]) : NaN;
              }
              await createPaymentRequest({
                requestFrom: Number.parseInt(selectedContact, 10),
                amountRequested: extractDecimalFromString(amount),
                appContext: { citySlug: "tcoin" },
              })
            }
            closeModal();
          }}
        >
          {method} {amount}
        </Button>
      </div>
    </div>
  );
};

export { ContactSelectModal };
