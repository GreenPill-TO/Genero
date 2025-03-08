import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Radio } from "@shared/components/ui/Radio";
import { useState } from "react";

interface ContactSelectModalProps {
  closeModal: () => void;
  amount: string;
  method: "Request" | "Send";
}

const contacts = [
  { value: "Alice", label: "Alice", id: "contact1" },
  { value: "Bob", label: "Bob", id: "contact2" },
  { value: "Charlie", label: "Charlie", id: "contact3" },
];

const ContactSelectModal = ({ closeModal, amount, method }: ContactSelectModalProps) => {
  const [selectedContact, setSelectedContact] = useState(contacts[0].value);
  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        {contacts.length>5 && (
        <Input placeholder="Search contacts..." />
        )}
        {contacts.map((contact) => {
          return (
            <Radio
              name="contact-selection"
              key={contact.id}
              label={contact.label}
              value={contact.value}
              onValueChange={setSelectedContact}
              id={contact.id}
              defaultChecked={contact.value === selectedContact}
            />
          );
        })}

        <Button
          className="w-full"
          disabled={!selectedContact}
          onClick={() => {
            console.log(`${method} ${amount} TCoin from/to ${selectedContact}`);
          }}
        >
          {method} {amount}
        </Button>
      </div>
    </div>
  );
};

export { ContactSelectModal };
