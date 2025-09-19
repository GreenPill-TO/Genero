import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Radio } from "@shared/components/ui/Radio";
import { createClient } from "@shared/lib/supabase/client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { fetchContactsForOwner, type ContactRecord } from "@shared/api/services/supabaseService";
import { insertSuccessNotification } from "@shared/utils/insertNotification";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { Hypodata } from "@tcoin/wallet/components/dashboard";

interface ContactSelectModalProps {
  closeModal: () => void;
  amount: string;
  setToSendData?: (contact: Hypodata) => void;
  method: "Request" | "Send";
}
const parseAmountFromString = (raw: string): number | null => {
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatContactLabel = (contact: ContactRecord) => {
  const name = contact.full_name?.trim();
  const username = contact.username?.trim();
  if (name && username) {
    return `${name} (@${username})`;
  }
  return name || (username ? `@${username}` : "Unknown contact");
};

const ContactSelectModal = ({ setToSendData, closeModal, amount, method }: ContactSelectModalProps) => {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "my">("my");
  const { userData } = useAuth();
  useEscapeKey(closeModal);

  useEffect(() => {
    let isMounted = true;
    const ownerId = userData?.cubidData?.id;
    if (!ownerId) {
      setContacts([]);
      setSelectedId(null);
      return () => {
        isMounted = false;
      };
    }

    fetchContactsForOwner(ownerId)
      .then((records) => {
        if (!isMounted) return;
        setContacts(records);
        setSelectedId(records[0]?.id ?? null);
      })
      .catch((error) => {
        console.error("Error fetching contacts:", error);
        if (isMounted) {
          setContacts([]);
          setSelectedId(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userData?.cubidData?.id]);

  const filteredContacts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const name = contact.full_name?.toLowerCase() ?? "";
      const username = contact.username?.toLowerCase() ?? "";
      return name.includes(query) || username.includes(query);
    });
  }, [contacts, searchTerm]);

  const allContacts = useMemo(
    () => filteredContacts.filter((contact) => contact.state === "new"),
    [filteredContacts]
  );
  const myContacts = useMemo(
    () => filteredContacts.filter((contact) => contact.state !== "new"),
    [filteredContacts]
  );

  const contactsToDisplay = activeTab === "all" ? allContacts : myContacts;

  useEffect(() => {
    if (contactsToDisplay.length === 0) {
      if (filteredContacts.length === 0) {
        setSelectedId(null);
      }
      return;
    }

    if (!contactsToDisplay.some((contact) => contact.id === selectedId)) {
      setSelectedId(contactsToDisplay[0]?.id ?? null);
    }
  }, [contactsToDisplay, filteredContacts.length, selectedId]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedId) ?? null,
    [contacts, selectedId]
  );

  const handleSubmit = async () => {
    if (!selectedContact) return;

    if (method === "Send") {
      setToSendData?.(selectedContact);
      closeModal();
      return;
    }

    const requestBy = userData?.cubidData?.id;
    const parsedAmount = parseAmountFromString(amount);
    if (!requestBy || parsedAmount === null) {
      console.error("Invalid request payload", { requestBy, amount });
      return;
    }

    try {
      const supabase = createClient();
      await supabase.from("invoice_pay_request").insert({
        request_from: selectedContact.id,
        request_by: requestBy,
        amount_requested: parsedAmount,
      });
      insertSuccessNotification({
        user_id: selectedContact.id,
        notification: `${amount} request by ${userData?.cubidData?.full_name}`,
      });
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      closeModal();
    }
  };

  return (
    <div className="mt-2 p-0">
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
              label={formatContactLabel(contact)}
              value={String(contact.id)}
              onValueChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                setSelectedId(Number.isFinite(parsed) ? parsed : null);
              }}
              id={`contact-${contact.id}`}
              checked={selectedId === contact.id}
            />
          ))
        ) : (
          <p>No contacts found.</p>
        )}

        <Button className="w-full" disabled={!selectedContact} onClick={handleSubmit}>
          {method} {amount}
        </Button>
      </div>
    </div>
  );
};

export { ContactSelectModal };
