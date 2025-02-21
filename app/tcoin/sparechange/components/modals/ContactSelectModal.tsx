import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Radio } from "@shared/components/ui/Radio";
import { useState, useEffect } from "react";
import { createClient } from "@shared/lib/supabase/client";
import { useAuth } from "@shared/api/hooks/useAuth";

interface ContactSelectModalProps {
  closeModal: () => void;
  amount: string;
  setToSendData: any;
  method: "Request" | "Send";
}

interface Contact {
  value: string;
  label: string;
  id: number | string;
}

const ContactSelectModal = ({ setToSendData, closeModal, amount, method }: ContactSelectModalProps) => {
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const supabase = createClient();
  const { userData } = useAuth();

  useEffect(() => {
    async function fetchContacts() {
      if (!userData?.cubidData?.id) return;

      // Fetch connections where the current user is the owner and the connection is accepted.
      const { data, error } = await supabase
        .from("connections")
        .select("*,connected_user_id(*)")
        .eq("owner_user_id", userData.cubidData.id)

      if (error) {
        console.error("Error fetching contacts:", error);
      } else if (data) {
        // Map each connection to the required shape.
        const mappedContacts = data.map((connection: any) => ({
          value: connection.connected_user_id,
          label: connection.connected_user_id?.full_name,
          id: connection.id,
        }));
        setContacts(mappedContacts);
        if (mappedContacts.length > 0) {
          setSelectedContact(mappedContacts[0].value);
        }
      }
    }
    fetchContacts();
  }, [userData, supabase]);

  const filteredContacts = contacts.filter((contact) =>
    contact.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {filteredContacts.length > 0 ? (
          filteredContacts.map((contact) => (
            <Radio
              name="contact-selection"
              key={contact.id}
              label={contact.label}
              value={contact.value}
              onValueChange={setSelectedContact}
              id={String(contact.id)}
              defaultChecked={contact.value === selectedContact}
            />
          ))
        ) : (
          <p>No contacts found.</p>
        )}

        <Button
          className="w-full"
          disabled={!selectedContact}
          onClick={() => {
            if (method === "Send") {
              setToSendData(selectedContact)
            }
            closeModal()
            console.log({ selectedContact });
            // You can add additional logic here (for example, passing the selected contact back to a parent component)
          }}
        >
          {method} {amount}
        </Button>
      </div>
    </div>
  );
};

export { ContactSelectModal };