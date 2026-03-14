"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";

type ProfileUser = {
  id: number;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  bio: string | null;
  country: string | null;
  address: string | null;
};

type ContactTransactionEntry = {
  id: number;
  amount: number;
  created_at: string | null;
  direction: "sent" | "received";
};

export default function ContactProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();

  const contactId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw !== "string") return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params?.id]);

  const currentUserId = userData?.cubidData?.id ?? null;
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [contactWallets, setContactWallets] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<ContactTransactionEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const { senderWallet, sendMoney } = useSendMoney({
    senderId: currentUserId ?? 0,
    receiverId: contactId,
  });
  const { balance: rawBalance } = useTokenBalance(senderWallet ?? null);
  const userBalance = Number.parseFloat(rawBalance) || 0;

  const displayName =
    profile?.full_name?.trim() || profile?.username?.trim() || (contactId != null ? `User ${contactId}` : "Contact");

  const loadProfile = useCallback(async () => {
    if (!contactId || !currentUserId) {
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    try {
      const supabase = createClient();

      const [profileResult, contactWalletsResult, myWalletsResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, full_name, username, profile_image_url, bio, country, address")
          .eq("id", contactId)
          .single(),
        supabase
          .from("wallet_list")
          .select("public_key")
          .eq("user_id", contactId),
        supabase
          .from("wallet_list")
          .select("public_key")
          .eq("user_id", currentUserId),
      ]);

      if (profileResult.error || !profileResult.data) {
        throw new Error(profileResult.error?.message ?? "Contact profile not found.");
      }

      const profileRow = profileResult.data as any;
      const parsedProfile: ProfileUser = {
        id: Number(profileRow.id),
        full_name: typeof profileRow.full_name === "string" ? profileRow.full_name : null,
        username: typeof profileRow.username === "string" ? profileRow.username : null,
        profile_image_url: typeof profileRow.profile_image_url === "string" ? profileRow.profile_image_url : null,
        bio: typeof profileRow.bio === "string" ? profileRow.bio : null,
        country: typeof profileRow.country === "string" ? profileRow.country : null,
        address: typeof profileRow.address === "string" ? profileRow.address : null,
      };
      setProfile(parsedProfile);

      const normalizeWallets = (rows: any[] | null | undefined) =>
        (rows ?? [])
          .map((row) =>
            typeof row.public_key === "string" && row.public_key.trim() !== "" ? row.public_key : null
          )
          .filter((value: string | null): value is string => value != null);

      const contactWalletList = normalizeWallets(contactWalletsResult.data as any[]);
      const myWalletList = normalizeWallets(myWalletsResult.data as any[]);

      setContactWallets(contactWalletList);
      if (contactWalletList.length === 0 || myWalletList.length === 0) {
        setTransactions([]);
        return;
      }

      const [sentRows, receivedRows] = await Promise.all([
        supabase
          .from("act_transaction_entries")
          .select("id, amount, created_at, wallet_account_from, wallet_account_to")
          .eq("currency", "TCOIN")
          .in("wallet_account_from", myWalletList)
          .in("wallet_account_to", contactWalletList)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("act_transaction_entries")
          .select("id, amount, created_at, wallet_account_from, wallet_account_to")
          .eq("currency", "TCOIN")
          .in("wallet_account_from", contactWalletList)
          .in("wallet_account_to", myWalletList)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const entries: ContactTransactionEntry[] = [];
      const seen = new Set<number>();

      const pushRows = (rows: any[] | null | undefined, direction: "sent" | "received") => {
        (rows ?? []).forEach((row) => {
          const id =
            typeof row.id === "number" ? row.id : Number.parseInt(String(row.id ?? ""), 10);
          if (!Number.isFinite(id) || seen.has(id)) return;
          seen.add(id);

          const amountRaw =
            typeof row.amount === "number" ? row.amount : Number.parseFloat(String(row.amount ?? ""));
          if (!Number.isFinite(amountRaw)) return;

          entries.push({
            id,
            amount: amountRaw,
            created_at: typeof row.created_at === "string" ? row.created_at : null,
            direction,
          });
        });
      };

      pushRows(sentRows.data as any[], "sent");
      pushRows(receivedRows.data as any[], "received");

      entries.sort((a, b) => {
        const aTs = a.created_at ? Date.parse(a.created_at) : 0;
        const bTs = b.created_at ? Date.parse(b.created_at) : 0;
        return bTs - aTs;
      });

      setTransactions(entries);
    } catch (error) {
      console.error("Failed to load contact profile", error);
      toast.error("Could not load this contact profile.");
      setTransactions([]);
      setContactWallets([]);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [contactId, currentUserId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSend = async () => {
    const numeric = Number.parseFloat(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a valid amount to send.");
      return;
    }
    if (numeric > userBalance) {
      toast.error("Amount exceeds your available balance.");
      return;
    }
    if (!contactId) {
      toast.error("Contact is unavailable.");
      return;
    }

    setIsSending(true);
    try {
      const txHash = await sendMoney(numeric.toFixed(2));
      toast.success("Payment sent.");
      setAmount("");
      if (txHash) {
        void loadProfile();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send payment.";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const submitRequest = async (requestAmount: number) => {
    if (!currentUserId || !contactId) {
      throw new Error("Missing request context");
    }

    const supabase = createClient();
    const { error } = await supabase.from("invoice_pay_request").insert({
      request_from: contactId,
      request_by: currentUserId,
      amount_requested: requestAmount,
      is_active: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("notifications").insert({
      user_id: String(contactId),
      notification: `${requestAmount.toFixed(2)} TCOIN request from ${displayName}`,
    });
  };

  const openRequestModal = () => {
    openModal({
      title: `Request money from ${displayName}`,
      description: "Enter an amount and send a payment request.",
      content: (
        <RequestMoneyModal
          contactName={displayName}
          onClose={closeModal}
          onSubmit={async (requestAmount) => {
            await submitRequest(requestAmount);
            closeModal();
            toast.success(`Request sent to ${displayName}.`);
          }}
        />
      ),
    });
  };

  const avatarFallback = displayName.charAt(0).toUpperCase() || "?";

  return (
    <div className="p-4 pb-24 lg:px-[25vw]">
      <div className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Contact Profile</h1>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>

        {isLoadingProfile ? (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">Contact not found.</p>
        ) : (
          <>
            <div className="flex items-start gap-4 rounded-lg border border-border/60 bg-background/70 p-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.profile_image_url ?? undefined} alt={displayName} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{displayName}</p>
                {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
                {profile.country && <p className="text-xs text-muted-foreground">Country: {profile.country}</p>}
                {profile.address && <p className="text-xs text-muted-foreground">Address: {profile.address}</p>}
                {contactWallets[0] && (
                  <p className="text-xs text-muted-foreground break-all">Wallet: {contactWallets[0]}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-4">
              <label htmlFor="profile-send-amount" className="text-sm font-medium">Amount to send (TCOIN)</label>
              <Input
                id="profile-send-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">Available: {userBalance.toFixed(4)} TCOIN</p>
              <Button type="button" className="w-full" onClick={() => void handleSend()} disabled={isSending}>
                {isSending ? "Sending..." : "Send"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={openRequestModal}>
                Request money from {displayName}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-4">
              <h2 className="text-sm font-semibold">Transaction History</h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions with this contact yet.</p>
              ) : (
                <ul className="space-y-2">
                  {transactions.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border/50 p-3">
                      <p className="text-sm font-medium">
                        {entry.direction === "sent" ? "Sent" : "Received"} {entry.amount.toLocaleString("en-CA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        TCOIN
                      </p>
                      {entry.created_at && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("en-CA", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RequestMoneyModal({
  contactName,
  onSubmit,
  onClose,
}: {
  contactName: string;
  onSubmit: (amount: number) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const numeric = Number.parseFloat(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a valid request amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(Number.parseFloat(numeric.toFixed(2)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create request.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Send a request to {contactName}.</p>
      <Input
        value={amount}
        onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
        placeholder="Amount in TCOIN"
        inputMode="decimal"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? "Requesting..." : "Send Request"}
        </Button>
      </div>
    </div>
  );
}
