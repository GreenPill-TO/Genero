import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Radio } from "@shared/components/ui/Radio";
import { useAuth } from "@shared/api/hooks/useAuth";
import { fetchContactsForOwner, type ContactRecord } from "@shared/api/services/supabaseService";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { Hypodata, contactRecordToHypodata } from "@tcoin/wallet/components/dashboard";

interface ContactSelectModalProps {
  closeModal: () => void;
  amount: string;
  setToSendData?: (contact: Hypodata) => void;
  method: "Request" | "Send";
  defaultContactId?: number | null;
  prefetchedContacts?: ContactRecord[];
  onSelectContact?: (contact: Hypodata) => void;
}
const formatContactLabel = (contact: ContactRecord) => {
  const name = contact.full_name?.trim();
  const username = contact.username?.trim();
  if (name && username) {
    return `${name} (@${username})`;
  }
  return name || (username ? `@${username}` : "Unknown contact");
};

const ContactSelectModal = ({
  setToSendData,
  closeModal,
  amount,
  method,
  defaultContactId,
  prefetchedContacts,
  onSelectContact,
}: ContactSelectModalProps) => {
  const [contacts, setContacts] = useState<ContactRecord[]>(prefetchedContacts ?? []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "my">("my");
  const { userData } = useAuth();
  useEscapeKey(closeModal);

  useEffect(() => {
    if (!prefetchedContacts) return;
    setContacts(prefetchedContacts);
  }, [prefetchedContacts]);

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
        if (records.length === 0) {
          setSelectedId(null);
          return;
        }
        const preferredId =
          typeof defaultContactId === "number"
            ? records.find((contact) => contact.id === defaultContactId)?.id ?? null
            : null;
        setSelectedId(preferredId ?? records[0]?.id ?? null);
      })
      .catch((error) => {
        console.error("Error fetching contacts:", error);
        if (isMounted) {
          if (prefetchedContacts?.length) {
            setContacts(prefetchedContacts);
            setSelectedId(prefetchedContacts[0]?.id ?? null);
          } else {
            setContacts([]);
            setSelectedId(null);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userData?.cubidData?.id, defaultContactId, prefetchedContacts]);

  useEffect(() => {
    if (typeof defaultContactId !== "number") return;
    if (!contacts.some((contact) => contact.id === defaultContactId)) return;
    setSelectedId(defaultContactId);
  }, [contacts, defaultContactId]);

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

  const contactsToDisplay = useMemo(() => {
    const scoped = activeTab === "all" ? allContacts : myContacts;
    if (scoped.length === 0) {
      return filteredContacts;
    }
    return scoped;
  }, [activeTab, allContacts, myContacts, filteredContacts]);

  const showTabs = allContacts.length > 0 && myContacts.length > 0;

  useEffect(() => {
    if (myContacts.length === 0 && allContacts.length > 0) {
      setActiveTab("all");
      return;
    }
    if (allContacts.length === 0 && myContacts.length > 0) {
      setActiveTab("my");
    }
  }, [allContacts.length, myContacts.length]);

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

    const normalisedContact = contactRecordToHypodata(selectedContact);

    if (method === "Send") {
      setToSendData?.(normalisedContact);
      onSelectContact?.(normalisedContact);
      closeModal();
      return;
    }

    onSelectContact?.(normalisedContact);
    closeModal();
    return;
  };

  return (
    <div className="mt-2 p-0">
      {showTabs && (
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
      )}
      <div className="space-y-4">
        {filteredContacts.length > 5 && (
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
          <p>
            {filteredContacts.length === 0
              ? "No contacts found."
              : "No contacts available in this view."}
          </p>
        )}

        <Button className="w-full" disabled={!selectedContact} onClick={handleSubmit}>
          {method} {amount}
        </Button>
      </div>
    </div>
  );
};

export { ContactSelectModal };
