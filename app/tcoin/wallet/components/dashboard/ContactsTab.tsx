import React, { useEffect, useState } from "react";
import { LuSend } from "react-icons/lu";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { createClient } from "@shared/lib/supabase/client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Hypodata } from "./types";

interface ContactsTabProps {
  onSend: (contact: Hypodata) => void;
}

export function ContactsTab({ onSend }: ContactsTabProps) {
  const { userData } = useAuth();
  const supabase = createClient();
  const [contacts, setContacts] = useState<Hypodata[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchContacts() {
      if (!userData?.cubidData?.id) return;
      const { data } = await supabase
        .from("connections")
        .select("*, connected_user_id(*)")
        .eq("owner_user_id", userData.cubidData.id)
        .neq("state", "rejected");
      if (data) {
        const mapped = data.map((c: any) => c.connected_user_id);
        setContacts(mapped);
      }
    }
    fetchContacts();
  }, [supabase, userData]);

  const filtered = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

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
              <span className="font-medium">{contact.full_name}</span>
              {contact.wallet_address && (
                <span className="text-sm text-muted-foreground">
                  {contact.wallet_address.slice(0, 6)}...
                  {contact.wallet_address.slice(-4)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => onSend(contact)}
            >
              <LuSend className="mr-2 h-4 w-4" /> Send
            </Button>
          </li>
        ))}
        {filtered.length === 0 && <p>No contacts found.</p>}
      </ul>
    </div>
  );
}
