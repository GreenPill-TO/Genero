import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useAuth } from "@shared/api/hooks/useAuth";
import {
  fetchContactsForOwner,
  type ContactRecord,
} from "@shared/api/services/supabaseService";
import { Hypodata, contactRecordToHypodata } from "./types";
import { useModal } from "@shared/contexts/ModalContext";
import { createClient } from "@shared/lib/supabase/client";

type SortOrder = "alphabetical" | "recents";

interface ContactTransactionEntry {
  id: number;
  amount: number;
  created_at: string | null;
  direction: "sent" | "received";
}

interface ContactTransactions {
  lastTransactionAt: string | null;
  entries: ContactTransactionEntry[];
}

interface ContactsTabProps {
  onSend: (contact: Hypodata) => void;
  onRequest?: (contact: Hypodata) => void;
  initialContacts?: ContactRecord[];
  onContactsResolved?: (contacts: ContactRecord[]) => void;
}

const formatName = (contact: ContactRecord) =>
  contact.full_name?.trim() || contact.username?.trim() || "Unknown";

const getInitials = (contact: ContactRecord) => {
  const name = formatName(contact);
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "?";
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export function ContactsTab({
  onSend,
  onRequest,
  initialContacts,
  onContactsResolved,
}: ContactsTabProps) {
  const { userData } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts ?? []);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");
  const { openModal, closeModal } = useModal();
  const [contactTransactions, setContactTransactions] = useState<
    Record<number, ContactTransactions>
  >({});
  const [userWallets, setUserWallets] = useState<string[] | null>(null);

  useEffect(() => {
    if (!initialContacts) return;
    setContacts(initialContacts);
  }, [initialContacts]);

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
        onContactsResolved?.(records.map((record) => ({ ...record })));
      })
      .catch((err) => {
        console.error("fetchContacts error", err);
        if (isMounted) {
          setContacts([]);
        }
        onContactsResolved?.([]);
      });

    return () => {
      isMounted = false;
    };
  }, [userData?.cubidData?.id, onContactsResolved]);

  useEffect(() => {
    let isMounted = true;
    const ownerId = userData?.cubidData?.id;
    if (!ownerId) {
      setUserWallets([]);
      return () => {
        isMounted = false;
      };
    }

    const supabase = createClient();

    const loadWallets = async () => {
      try {
        const { data, error } = await supabase
          .from("wallet_list")
          .select("public_key")
          .eq("user_id", ownerId);
        if (error) throw error;
        const wallets = (data ?? [])
          .map((row) =>
            typeof row.public_key === "string" && row.public_key.trim() !== ""
              ? row.public_key
              : null
          )
          .filter((value): value is string => value != null);
        if (!isMounted) return;
        setUserWallets(wallets);
      } catch (error) {
        console.error("Failed to load user wallets", error);
        if (isMounted) {
          setUserWallets([]);
        }
      }
    };

    void loadWallets();

    return () => {
      isMounted = false;
    };
  }, [userData?.cubidData?.id]);

  useEffect(() => {
    let isMounted = true;
    if (contacts.length === 0) {
      setContactTransactions({});
      return () => {
        isMounted = false;
      };
    }

    if (userWallets == null) {
      return () => {
        isMounted = false;
      };
    }

    if (userWallets.length === 0) {
      const emptyState: Record<number, ContactTransactions> = {};
      contacts.forEach((contact) => {
        emptyState[contact.id] = { lastTransactionAt: null, entries: [] };
      });
      setContactTransactions(emptyState);
      return () => {
        isMounted = false;
      };
    }

    const supabase = createClient();

    const loadTransactions = async () => {
      const results = await Promise.all(
        contacts.map(async (contact) => {
          try {
            const { data: walletRows, error: walletError } = await supabase
              .from("wallet_list")
              .select("public_key")
              .eq("user_id", contact.id);
            if (walletError) throw walletError;
            const contactWallets = (walletRows ?? [])
              .map((row) =>
                typeof row.public_key === "string" && row.public_key.trim() !== ""
                  ? row.public_key
                  : null
              )
              .filter((value): value is string => value != null);

            if (contactWallets.length === 0) {
              return {
                contactId: contact.id,
                info: { lastTransactionAt: null, entries: [] as ContactTransactionEntry[] },
              };
            }

            const fetchEntries = async (
              column: "wallet_account_to" | "wallet_account_from"
            ) => {
              const { data, error } = await supabase
                .from("act_transaction_entries")
                .select("id, wallet_account_to, wallet_account_from, amount, created_at")
                .eq("currency", "TCOIN")
                .in(column, contactWallets)
                .order("created_at", { ascending: false })
                .limit(50);
              if (error) throw error;
              return data ?? [];
            };

            const [toRows, fromRows] = await Promise.all([
              fetchEntries("wallet_account_to"),
              fetchEntries("wallet_account_from"),
            ]);

            const combined = [...toRows, ...fromRows];
            const seen = new Set<number>();
            const entries: ContactTransactionEntry[] = [];

            combined.forEach((row: any) => {
              const rowId =
                typeof row.id === "number"
                  ? row.id
                  : Number.parseInt(String(row.id ?? ""), 10);
              if (!Number.isFinite(rowId) || seen.has(rowId)) return;
              seen.add(rowId);

              const from =
                typeof row.wallet_account_from === "string"
                  ? row.wallet_account_from
                  : null;
              const to =
                typeof row.wallet_account_to === "string"
                  ? row.wallet_account_to
                  : null;

              const amountRaw = row.amount;
              const numericAmount =
                typeof amountRaw === "number"
                  ? amountRaw
                  : Number.parseFloat(typeof amountRaw === "string" ? amountRaw : "");

              if (!Number.isFinite(numericAmount)) {
                return;
              }

              const contactSent =
                from != null && contactWallets.includes(from) && to != null && userWallets.includes(to);
              const contactReceived =
                to != null && contactWallets.includes(to) && from != null && userWallets.includes(from);

              if (!contactSent && !contactReceived) {
                return;
              }

              entries.push({
                id: rowId,
                amount: numericAmount,
                created_at: typeof row.created_at === "string" ? row.created_at : null,
                direction: contactSent ? "sent" : "received",
              });
            });

            entries.sort((a, b) => {
              const aTime = a.created_at ? Date.parse(a.created_at) : 0;
              const bTime = b.created_at ? Date.parse(b.created_at) : 0;
              return bTime - aTime;
            });

            return {
              contactId: contact.id,
              info: {
                lastTransactionAt: entries[0]?.created_at ?? null,
                entries,
              },
            };
          } catch (error) {
            console.error("Failed to load transactions for contact", contact.id, error);
            return {
              contactId: contact.id,
              info: { lastTransactionAt: null, entries: [] as ContactTransactionEntry[] },
            };
          }
        })
      );

      if (!isMounted) return;

      const next: Record<number, ContactTransactions> = {};
      results.forEach((result) => {
        next[result.contactId] = result.info;
      });
      setContactTransactions(next);
    };

    void loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [contacts, userWallets]);

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

  const openTransactionsModal = (contact: ContactRecord) => {
    const summary = contactTransactions[contact.id];
    openModal({
      title: `Transactions with ${formatName(contact)}`,
      description: "Review your recent TCOIN transfers with this contact.",
      content: (
        <TransactionsModal
          summary={summary}
          contactName={formatName(contact)}
          onClose={closeModal}
        />
      ),
    });
  };

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
        {filtered.map((contact) => {
          const summary = contactTransactions[contact.id];
          const formattedLast = summary?.lastTransactionAt
            ? formatTimestamp(summary.lastTransactionAt)
            : null;

          return (
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
                  {summary ? (
                    summary.lastTransactionAt && formattedLast ? (
                      <span className="text-xs text-muted-foreground">
                        Last transaction: {formattedLast}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No transactions yet</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">Loading transactions…</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onSend(contactRecordToHypodata(contact))}
                  aria-label={`Send to ${formatName(contact)}`}
                >
                  Send To
                </Button>
                {onRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRequest(contactRecordToHypodata(contact))}
                    aria-label={`Request from ${formatName(contact)}`}
                  >
                    Request From
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openTransactionsModal(contact)}
                  aria-label={`View transactions with ${formatName(contact)}`}
                >
                  View Transactions
                </Button>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && <p>No contacts found.</p>}
      </ul>
    </div>
  );
}

function TransactionsModal({
  summary,
  contactName,
  onClose,
}: {
  summary?: ContactTransactions;
  contactName: string;
  onClose: () => void;
}) {
  if (!summary) {
    return (
      <div className="space-y-4 p-2">
        <p className="text-sm text-muted-foreground">
          Loading transactions for {contactName}…
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (summary.entries.length === 0) {
    return (
      <div className="space-y-4 p-2">
        <p className="text-sm text-muted-foreground">
          No transactions with {contactName} yet.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <ul className="space-y-2">
        {summary.entries.map((entry) => {
          const timestamp = entry.created_at
            ? formatTimestamp(entry.created_at) ?? entry.created_at
            : null;
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/80 p-3"
            >
              <span className="text-sm font-medium">
                {entry.direction === "sent" ? "Sent" : "Received"}{" "}
                {entry.amount.toLocaleString("en-CA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                TCOIN
              </span>
              {timestamp && (
                <span className="text-xs text-muted-foreground">{timestamp}</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
