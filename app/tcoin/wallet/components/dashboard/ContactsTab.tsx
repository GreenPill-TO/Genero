import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Mail, Upload, Users } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useAuth } from "@shared/api/hooks/useAuth";
import {
  fetchContactsForOwner,
  type ContactRecord,
} from "@shared/api/services/supabaseService";
import { Hypodata, contactRecordToHypodata } from "./types";
import { useModal } from "@shared/contexts/ModalContext";
import {
  getWalletContactImports,
  getWalletContactTransactionHistory,
  queueWalletContactInviteBatch,
  saveWalletContactImports,
} from "@shared/lib/edge/walletOperationsClient";
import type { WalletImportedContact } from "@shared/lib/edge/walletOperations";
import {
  walletActionButtonClass,
  walletActionRowClass,
  walletActionRowIconClass,
  walletBadgeClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "./authenticated-ui";

type SortOrder = "alphabetical" | "recents";

type ContactPickerContact = {
  name?: string[];
  email?: string[];
};

type NavigatorWithContacts = Navigator & {
  contacts?: {
    select: (
      properties: Array<"name" | "email">,
      options?: { multiple?: boolean }
    ) => Promise<ContactPickerContact[]>;
  };
};

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

type ManualInviteRow = {
  id: number;
  value: string;
};

type InviteRecipient = {
  email: string;
  displayName: string | null;
  source: "manual" | "imported";
};

const DEFAULT_INVITE_SUBJECT = "Join me on TCOIN";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

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

const normaliseEmail = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
};

const buildInviteMessage = (inviterName: string) =>
  [
    "Hi,",
    "",
    `${inviterName} invited you to join them on TCOIN.`,
    "It is a simple way to send and receive money locally, with community impact built in.",
    "",
    "If you are curious, reply to this note and we can get set up together.",
    "",
    `See you soon,`,
    inviterName,
  ].join("\n");

const normalisePickerContacts = (contacts: ContactPickerContact[]) => {
  const deduped = new Map<string, { displayName: string | null; email: string }>();

  contacts.forEach((contact) => {
    const email = normaliseEmail(contact.email?.[0] ?? "");
    if (!email) {
      return;
    }
    deduped.set(email, {
      displayName: contact.name?.[0]?.trim() || null,
      email,
    });
  });

  return Array.from(deduped.values());
};

function getContactPicker() {
  if (typeof navigator === "undefined") {
    return null;
  }
  const picker = (navigator as NavigatorWithContacts).contacts?.select;
  return typeof picker === "function" ? picker : null;
}

export function ContactsTab({
  onSend,
  onRequest,
  initialContacts,
  onContactsResolved,
}: ContactsTabProps) {
  const { userData } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts ?? []);
  const [isLoadingContacts, setIsLoadingContacts] = useState(!initialContacts);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");
  const { openModal, closeModal } = useModal();
  const [contactTransactions, setContactTransactions] = useState<
    Record<number, ContactTransactions>
  >({});

  useEffect(() => {
    if (!initialContacts) return;
    setContacts(initialContacts);
    setIsLoadingContacts(false);
  }, [initialContacts]);

  useEffect(() => {
    let isMounted = true;
    const ownerId = userData?.cubidData?.id;
    if (!ownerId) {
      setContacts([]);
      setIsLoadingContacts(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingContacts(!(initialContacts && initialContacts.length > 0));
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
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingContacts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialContacts, userData?.cubidData?.id, onContactsResolved]);

  useEffect(() => {
    let isMounted = true;
    if (contacts.length === 0) {
      setContactTransactions({});
      return () => {
        isMounted = false;
      };
    }

    const loadTransactions = async () => {
      const results = await Promise.all(
        contacts.map(async (contact) => {
          try {
            const response = await getWalletContactTransactionHistory(contact.id, { citySlug: "tcoin" });
            const entries: ContactTransactionEntry[] = (response.transactions ?? []).map((row) => ({
              id: Number(row.id),
              amount: Number(row.amount),
              created_at: row.createdAt,
              direction: row.direction === "received" ? "received" : "sent",
            }));

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
  }, [contacts]);

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

  const inviterName =
    userData?.cubidData?.nickname?.trim() ||
    userData?.cubidData?.given_names?.trim() ||
    userData?.cubidData?.full_name?.trim() ||
    userData?.cubidData?.username?.trim() ||
    "A friend";
  const inviterEmail = userData?.user?.email?.trim() || userData?.cubidData?.email?.trim() || null;

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

  const showEmptyInviteFlow =
    !isLoadingContacts && contacts.length === 0 && search.trim().length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Contacts
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">People you trust</h1>
        </div>
        {contacts.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={sortOrder === "alphabetical" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSortOrder("alphabetical")}
            >
              Alphabetical
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortOrder === "recents" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setSortOrder("recents")}
            >
              Recents
            </Button>
          </div>
        ) : null}
      </div>

      {contacts.length > 0 ? (
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="wallet-auth-input h-12 rounded-2xl"
        />
      ) : null}

      {isLoadingContacts ? (
        <div className={walletPanelMutedClass}>
          <p className="text-sm text-muted-foreground">Loading your contacts…</p>
        </div>
      ) : showEmptyInviteFlow ? (
        <ContactsInviteEmptyState inviterName={inviterName} inviterEmail={inviterEmail} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((contact) => {
            const summary = contactTransactions[contact.id];
            const formattedLast = summary?.lastTransactionAt
              ? formatTimestamp(summary.lastTransactionAt)
              : null;

            return (
              <li
                key={contact.id}
                className={`${walletPanelMutedClass} flex flex-wrap items-center justify-between gap-4`}
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
                    className="rounded-full"
                    onClick={() => onSend(contactRecordToHypodata(contact))}
                    aria-label={`Send to ${formatName(contact)}`}
                  >
                    Send To
                  </Button>
                  {onRequest && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => onRequest(contactRecordToHypodata(contact))}
                      aria-label={`Request from ${formatName(contact)}`}
                    >
                      Request From
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={walletActionButtonClass}
                    onClick={() => openTransactionsModal(contact)}
                    aria-label={`View transactions with ${formatName(contact)}`}
                  >
                    View Transactions
                  </Button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className={walletPanelMutedClass}>
              <p className="text-sm text-muted-foreground">
                No contacts match that search yet.
              </p>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function ContactsInviteEmptyState({
  inviterName,
  inviterEmail,
}: {
  inviterName: string;
  inviterEmail: string | null;
}) {
  const [importedContacts, setImportedContacts] = useState<WalletImportedContact[]>([]);
  const [selectedImportedEmails, setSelectedImportedEmails] = useState<Record<string, boolean>>({});
  const [manualRows, setManualRows] = useState<ManualInviteRow[]>([{ id: 1, value: "" }]);
  const [nextManualRowId, setNextManualRowId] = useState(2);
  const [subject, setSubject] = useState(DEFAULT_INVITE_SUBJECT);
  const [message, setMessage] = useState(() => buildInviteMessage(inviterName));
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [hasImportPermission, setHasImportPermission] = useState(false);
  const [queuedSummary, setQueuedSummary] = useState<{
    recipientCount: number;
    queuedAt: string | null;
  } | null>(null);

  const contactPicker = getContactPicker();

  useEffect(() => {
    let isMounted = true;

    void getWalletContactImports({ citySlug: "tcoin" })
      .then((response) => {
        if (!isMounted) return;
        setImportedContacts(response.importedContacts ?? []);
        setHasImportPermission(response.preference?.granted ?? false);
      })
      .catch((error) => {
        console.error("Failed to load contact imports", error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingImports(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const manualRecipients = useMemo<InviteRecipient[]>(() => {
    const deduped = new Map<string, InviteRecipient>();
    manualRows.forEach((row) => {
      const email = normaliseEmail(row.value);
      if (!email) {
        return;
      }
      deduped.set(email, {
        email,
        displayName: null,
        source: "manual",
      });
    });
    return Array.from(deduped.values());
  }, [manualRows]);

  const selectedImportedRecipients = useMemo<InviteRecipient[]>(
    () =>
      importedContacts
        .filter((contact) => selectedImportedEmails[contact.email])
        .map((contact) => ({
          email: contact.email,
          displayName: contact.displayName,
          source: "imported" as const,
        })),
    [importedContacts, selectedImportedEmails]
  );

  const recipients = useMemo(() => {
    const deduped = new Map<string, InviteRecipient>();
    [...selectedImportedRecipients, ...manualRecipients].forEach((recipient) => {
      deduped.set(recipient.email, recipient);
    });
    return Array.from(deduped.values());
  }, [manualRecipients, selectedImportedRecipients]);

  const invalidManualCount = manualRows.filter(
    (row) => row.value.trim().length > 0 && !normaliseEmail(row.value)
  ).length;

  const handleImportContacts = async () => {
    if (!contactPicker) {
      toast.info("This device does not offer contact import. You can still add email addresses manually.");
      return;
    }

    setIsImporting(true);
    try {
      const pickerContacts = await contactPicker(["name", "email"], { multiple: true });
      const normalised = normalisePickerContacts(pickerContacts);

      const response = await saveWalletContactImports(
        {
          granted: true,
          source: "browser-contact-picker",
          contacts: normalised,
        },
        { citySlug: "tcoin" }
      );

      setImportedContacts(response.importedContacts ?? []);
      setHasImportPermission(response.preference?.granted ?? true);

      if (normalised.length === 0) {
        toast.info("We saved your contact-import permission, but none of the selected contacts had an email address.");
      } else {
        toast.success(`Saved ${normalised.length} contact${normalised.length === 1 ? "" : "s"} for inviting.`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We could not import contacts right now.";
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleImportedEmail = (email: string) => {
    setSelectedImportedEmails((current) => ({
      ...current,
      [email]: !current[email],
    }));
  };

  const handleManualRowChange = (id: number, value: string) => {
    setManualRows((current) =>
      current.map((row) => (row.id === id ? { ...row, value } : row))
    );
  };

  const addManualRow = () => {
    setManualRows((current) => [...current, { id: nextManualRowId, value: "" }]);
    setNextManualRowId((current) => current + 1);
  };

  const removeManualRow = (id: number) => {
    setManualRows((current) =>
      current.length === 1 ? [{ id: current[0].id, value: "" }] : current.filter((row) => row.id !== id)
    );
  };

  const handleQueueBatch = async () => {
    if (recipients.length === 0) {
      toast.error("Choose at least one email address before queuing the invite batch.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Add a subject for the invite email.");
      return;
    }
    if (!message.trim()) {
      toast.error("Add a message for the invite email.");
      return;
    }

    setIsQueueing(true);
    try {
      const response = await queueWalletContactInviteBatch(
        {
          subject,
          message,
          recipients: recipients.map((recipient) => ({
            email: recipient.email,
            displayName: recipient.displayName,
            source: recipient.source,
          })),
        },
        { citySlug: "tcoin" }
      );

      setQueuedSummary({
        recipientCount: response.batch?.recipientCount ?? recipients.length,
        queuedAt: response.batch?.createdAt ?? null,
      });
      setSelectedImportedEmails({});
      setManualRows([{ id: 1, value: "" }]);
      setNextManualRowId(2);
      toast.success("Invite batch queued.");
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "We could not queue that invite batch.";
      toast.error(reason);
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${walletPanelClass} space-y-4`}>
        <span className={walletBadgeClass}>Contact onboarding</span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
            It looks empty here.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            TCOIN is about collaboration. Let&apos;s invite a few of your friends.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            You can import saved contacts from this device where supported, or type in email addresses yourself.
            We&apos;ll queue the invites for the next email batch instead of sending them immediately.
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className={`${walletPanelClass} space-y-4`}>
          <div className="space-y-1">
            <p className={walletSectionLabelClass}>1. Bring in people</p>
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Choose who to invite
            </h3>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={`${walletPanelMutedClass} space-y-3`}>
              <div className="flex items-start gap-3">
                <div className={walletActionRowIconClass}>
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-900 dark:text-white">Import contacts</p>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Ask this device for contact access, save the email contacts we find, then pick who should get an invite.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="w-full rounded-full"
                onClick={handleImportContacts}
                disabled={!contactPicker || isImporting}
              >
                {isImporting
                  ? "Importing contacts…"
                  : contactPicker
                    ? "Import contacts"
                    : "Contact import unavailable here"}
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasImportPermission
                  ? "Your contact-import permission is already saved for this wallet."
                  : "We will save your contact-import choice for this wallet after you approve it."}
              </p>
            </div>

            <div className={`${walletPanelMutedClass} space-y-3`}>
              <div className="flex items-start gap-3">
                <div className={walletActionRowIconClass}>
                  <Mail className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-900 dark:text-white">Add email addresses</p>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Type one email at a time, then keep going with “Add another” until your list feels right.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {manualRows.map((row, index) => (
                  <div key={row.id} className="flex gap-2">
                    <Input
                      type="email"
                      value={row.value}
                      placeholder={index === 0 ? "friend@example.com" : "another.friend@example.com"}
                      onChange={(event) => handleManualRowChange(row.id, event.target.value)}
                      className="h-11 rounded-2xl"
                      aria-label={`Manual invite email ${index + 1}`}
                    />
                    {manualRows.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => removeManualRow(row.id)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={addManualRow}
                >
                  Add another
                </Button>
                {invalidManualCount > 0 ? (
                  <span className="text-xs text-amber-600 dark:text-amber-300">
                    {invalidManualCount} email address{invalidManualCount === 1 ? "" : "es"} still need attention.
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`${walletPanelMutedClass} space-y-3`}>
            <div className="flex items-start gap-3">
              <div className={walletActionRowIconClass}>
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-slate-900 dark:text-white">Saved contacts with email</p>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Pick from the contacts we have saved for this wallet. Only contacts with email addresses appear here.
                </p>
              </div>
            </div>
            {isLoadingImports ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading saved imports…</p>
            ) : importedContacts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No saved email contacts yet. Import some from this device, or use manual email entry.
              </p>
            ) : (
              <div className="space-y-2">
                {importedContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className={`${walletActionRowClass} grid-cols-[auto_minmax(0,1fr)] items-center`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selectedImportedEmails[contact.email])}
                      onChange={() => toggleImportedEmail(contact.email)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="space-y-1">
                      <span className="block font-medium text-slate-900 dark:text-white">
                        {contact.displayName || contact.email}
                      </span>
                      <span className="block text-sm text-slate-600 dark:text-slate-300">
                        {contact.email}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={`${walletPanelClass} space-y-4`}>
          <div className="space-y-1">
            <p className={walletSectionLabelClass}>2. Review the note</p>
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Queue the invite batch
            </h3>
          </div>

          <div className={`${walletPanelMutedClass} space-y-3`}>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Invitees selected:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{recipients.length}</span>
            </p>
            {recipients.length > 0 ? (
              <ul className="space-y-2">
                {recipients.map((recipient) => (
                  <li key={recipient.email} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {recipient.displayName || recipient.email}
                    </span>
                    <span className="rounded-full border border-slate-200/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-slate-300">
                      {recipient.source}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pick imported contacts, add manual emails, or both.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Subject</span>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="h-11 rounded-2xl"
                placeholder="Join me on TCOIN"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Message</span>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[220px] rounded-[24px] px-4 py-3"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              This will be marked for the invite email batch job. {inviterEmail ? `Reply-to can use ${inviterEmail}.` : ""}
            </p>
          </div>

          <Button
            type="button"
            className="w-full rounded-full"
            onClick={handleQueueBatch}
            disabled={isQueueing || recipients.length === 0}
          >
            {isQueueing ? "Queueing invite batch…" : "Queue invite batch"}
          </Button>

          {queuedSummary ? (
            <div className={`${walletPanelMutedClass} space-y-1`}>
              <p className="font-medium text-slate-900 dark:text-white">
                {queuedSummary.recipientCount} invite{queuedSummary.recipientCount === 1 ? "" : "s"} queued.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {queuedSummary.queuedAt
                  ? `Queued ${formatTimestamp(queuedSummary.queuedAt) ?? queuedSummary.queuedAt}.`
                  : "Queued for the next email batch."}
              </p>
            </div>
          ) : null}
        </section>
      </div>
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
