import React, { useEffect, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useAuth } from "@shared/api/hooks/useAuth";
import { fetchContactsForOwner, type ContactRecord } from "@shared/api/services/supabaseService";
import { Hypodata } from "./types";

interface ContactsTabProps {
  onSend: (contact: Hypodata) => void;
}

export function ContactsTab({ onSend }: ContactsTabProps) {
  const { userData } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    const ownerId = userData?.cubidData?.id;
    if (!ownerId) {
      setContacts([]);
      return () => {
        isMounted = false;
      };
    }

    fetchContactsForOwner(ownerId)
      .then((records) => {
        if (!isMounted) return;
        setContacts(records);
      })
      .catch((err) => {
        console.error("fetchContacts error", err);
        if (isMounted) {
          setContacts([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userData?.cubidData?.id]);

  const filtered = contacts.filter((contact) => {
    const name = contact.full_name?.toLowerCase() ?? "";
    const username = contact.username?.toLowerCase() ?? "";
    const query = search.toLowerCase();
    return name.includes(query) || username.includes(query);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <Button variant="outline" size="sm">Add Contact</Button>
      </div>
      <Input
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.map((contact) => (
          <li
            key={contact.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex flex-col">
              <span className="font-medium">{contact.full_name ?? "Unknown"}</span>
              {contact.username && (
                <span className="text-sm text-muted-foreground">@{contact.username}</span>
              )}
              {contact.wallet_address && (
                <span className="text-sm text-muted-foreground">
                  {contact.wallet_address.slice(0, 6)}...
                  {contact.wallet_address.slice(-4)}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => onSend(contact)}>
              Select
            </Button>
          </li>
        ))}
        {filtered.length === 0 && <p>No contacts found.</p>}
      </ul>
    </div>
  );
}
