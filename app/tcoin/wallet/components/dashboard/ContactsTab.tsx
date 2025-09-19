import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useAuth } from "@shared/api/hooks/useAuth";
import {
  fetchContactsForOwner,
  type ContactRecord,
} from "@shared/api/services/supabaseService";
import { Hypodata } from "./types";

type SortOrder = "alphabetical" | "recents";

interface ContactsTabProps {
  onSend: (contact: Hypodata) => void;
  onRequest?: (contact: Hypodata) => void;
}

const formatName = (contact: ContactRecord) =>
  contact.full_name?.trim() || contact.username?.trim() || "Unknown";

const getInitials = (contact: ContactRecord) => {
  const name = formatName(contact);
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?";
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function ContactsTab({ onSend, onRequest }: ContactsTabProps) {
  const { userData } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = contacts.filter((contact) => {
      if (!query) return true;
      const name = contact.full_name?.toLowerCase() ?? "";
      const username = contact.username?.toLowerCase() ?? "";
      return name.includes(query) || username.includes(query);
    });

    if (sortOrder === "alphabetical") {
      return [...base].sort((a, b) => {
        const nameA = formatName(a).toLowerCase();
        const nameB = formatName(b).toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
    }

    return [...base].sort((a, b) => {
      const getTimestamp = (contact: ContactRecord) => {
        const raw = contact.last_interaction;
        const parsed = raw ? Date.parse(raw) : NaN;
        return Number.isNaN(parsed) ? -Infinity : parsed;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [contacts, search, sortOrder]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={sortOrder === "alphabetical" ? "default" : "outline"}
            onClick={() => setSortOrder("alphabetical")}
          >
            Alphabetical
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sortOrder === "recents" ? "default" : "outline"}
            onClick={() => setSortOrder("recents")}
          >
            Recents
          </Button>
        </div>
      </div>
      <Input
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="space-y-3">
        {filtered.map((contact) => (
          <li
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card/40 p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.profile_image_url ?? undefined} alt={formatName(contact)} />
                <AvatarFallback>{getInitials(contact)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{formatName(contact)}</span>
                {contact.username && (
                  <span className="text-sm text-muted-foreground">@{contact.username}</span>
                )}
                {contact.wallet_address && (
                  <span className="text-xs text-muted-foreground">
                    {contact.wallet_address.slice(0, 6)}…
                    {contact.wallet_address.slice(-4)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => onSend(contact)}
                aria-label={`Send to ${formatName(contact)}`}
              >
                Send To
              </Button>
              {onRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRequest(contact)}
                  aria-label={`Request from ${formatName(contact)}`}
                >
                  Request From
                </Button>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <p>No contacts found.</p>}
      </ul>
    </div>
  );
}
