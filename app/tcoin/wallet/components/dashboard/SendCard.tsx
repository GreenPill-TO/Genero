import React, { useEffect, useMemo, useRef, useState } from "react";
import { LuRefreshCcw, LuSend, LuUserPlus, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useModal } from "@shared/contexts/ModalContext";
import { createClient } from "@shared/lib/supabase/client";
import { insertSuccessNotification } from "@shared/utils/insertNotification";
import { ContactSelectModal } from "@tcoin/wallet/components/modals";
import { Hypodata, contactRecordToHypodata } from "./types";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import type { TransferRecordSnapshot } from "@shared/utils/transferRecord";

const FONT_SIZE_MAX_REM = 4.5;
const FONT_SIZE_MIN_REM = 1.1;
const FONT_SIZE_CHAR_THRESHOLD = 6;
const FONT_SIZE_REDUCTION_STEP = 0.4;

export function calculateResponsiveFontSize(displayValue: string) {
  const trimmed = displayValue.replace(/\s+/g, "");
  const visibleChars = trimmed.length;
  if (visibleChars === 0) {
    return `min(${FONT_SIZE_MAX_REM.toFixed(2)}rem, 12vw)`;
  }

  const overflow = Math.max(0, visibleChars - FONT_SIZE_CHAR_THRESHOLD);
  const adjusted = Math.max(
    FONT_SIZE_MIN_REM,
    FONT_SIZE_MAX_REM - overflow * FONT_SIZE_REDUCTION_STEP
  );

  return `min(${adjusted.toFixed(2)}rem, 12vw)`;
}

const formatTcoinDisplay = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return `${trimmed} TCOIN`;
  }
  return `${num.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TCOIN`;
};

const formatCadDisplay = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return `$${trimmed}`;
  }
  return `$${num.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatContactName = (contact: Hypodata) =>
  contact.full_name?.trim() || contact.username?.trim() || "Unknown";

const getContactInitials = (contact: Hypodata) => {
  const name = formatContactName(contact);
  const parts = name.split(" ");
  if (parts.length === 1) {
    return parts[0]?.[0]?.toUpperCase() ?? "?";
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export interface PaymentCompletionDetails {
  transactionHash: string;
  transactionId?: number | null;
  transferRecord?: unknown;
}

interface SendCardProps {
  sendMoney: (amount: string) => Promise<string>;
  toSendData: Hypodata | null;
  setToSendData: (data: Hypodata | null) => void;
  tcoinAmount: string;
  cadAmount: string;
  handleTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTcoinBlur: () => void;
  handleCadBlur: () => void;
  explorerLink: string | null;
  setExplorerLink: (link: string | null) => void;
  userBalance: number;
  onUseMax: () => void;
  locked?: boolean;
  contacts?: ContactRecord[];
  amountHeaderActions?: React.ReactNode;
  actionLabel?: string;
  getLastTransferRecord?: () => TransferRecordSnapshot | null;
  onPaymentComplete?: (details: PaymentCompletionDetails) => void;
}

export function SendCard({
  toSendData,
  setToSendData,
  tcoinAmount,
  cadAmount,
  handleTcoinChange,
  handleCadChange,
  handleTcoinBlur,
  handleCadBlur,
  explorerLink,
  setExplorerLink,
  sendMoney,
  userBalance,
  onUseMax,
  locked = false,
  contacts,
  amountHeaderActions,
  actionLabel = "Send...",
  getLastTransferRecord,
  onPaymentComplete,
}: SendCardProps) {
  const [connections, setConnections] = useState<any>(null);
  const { userData } = useAuth();
  const { openModal, closeModal } = useModal();
  const [isCadInput, setIsCadInput] = useState(false);
  const [isTcoinFocused, setIsTcoinFocused] = useState(false);
  const [isCadFocused, setIsCadFocused] = useState(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const recipientInputRef = useRef<HTMLInputElement | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const [recipientQuery, setRecipientQuery] = useState("");
  const previousRecipientIdRef = useRef<number | null>(null);
  const hasAmountForAdvance = useMemo(() => {
    const parsedTcoin = Number.parseFloat(tcoinAmount);
    const parsedCad = Number.parseFloat(cadAmount);
    return (
      (Number.isFinite(parsedTcoin) && parsedTcoin > 0) ||
      (Number.isFinite(parsedCad) && parsedCad > 0)
    );
  }, [cadAmount, tcoinAmount]);

  useEffect(() => {
    if (!toSendData?.id || !userData?.cubidData?.id) return;
    const fetchConnections = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("connections")
          .select("*")
          .match({
            connected_user_id: toSendData.id,
            owner_user_id: userData.cubidData.id,
          })
          .neq("state", "new");
        if (error) throw error;
        setConnections(data?.[0] ?? null);
      } catch (err) {
        console.error("fetchConnections error", err);
      }
    };
    fetchConnections();
  }, [toSendData?.id, userData?.cubidData?.id]);

  useEffect(() => {
    const timer = setTimeout(() => amountInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toSendData) {
      previousRecipientIdRef.current = null;
      return;
    }

    if (previousRecipientIdRef.current === toSendData.id) {
      return;
    }

    previousRecipientIdRef.current = toSendData.id;

    const timer = setTimeout(() => {
      if (hasAmountForAdvance) {
        sendButtonRef.current?.focus();
      } else {
        amountInputRef.current?.focus();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [hasAmountForAdvance, toSendData]);

  const tcoinValue = Number.parseFloat(tcoinAmount);
  const cadValue = Number.parseFloat(cadAmount);
  const hasTcoinAmount = Number.isFinite(tcoinValue) && tcoinValue > 0;
  const amountExceedsBalance = Number.isFinite(tcoinValue) && tcoinValue > userBalance;
  const canSend = Boolean(toSendData) && hasTcoinAmount;

  const amountLocked =
    locked &&
    ((isCadInput ? cadAmount : tcoinAmount) !== "0" &&
      (isCadInput ? cadAmount : tcoinAmount) !== "");

  const displayValue = useMemo(() => {
    if (isCadInput) {
      return isCadFocused ? cadAmount : formatCadDisplay(cadAmount);
    }
    return isTcoinFocused ? tcoinAmount : formatTcoinDisplay(tcoinAmount);
  }, [isCadInput, isCadFocused, cadAmount, isTcoinFocused, tcoinAmount]);

  const fontSize = useMemo(
    () => calculateResponsiveFontSize(displayValue),
    [displayValue]
  );
  const contactModalAmount = useMemo(() => {
    const trimmed = tcoinAmount.trim();
    if (trimmed === "") {
      return "TCOIN";
    }
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      return "TCOIN";
    }
    return `${parsed.toFixed(2)} TCOIN`;
  }, [tcoinAmount]);

  const handleContactSelection = (contact: Hypodata) => {
    setToSendData(contact);
    setRecipientQuery("");
  };

  const handleContactRecordSelection = (contact: ContactRecord) => {
    handleContactSelection(contactRecordToHypodata(contact));
  };

  const openContactSelector = () => {
    if (locked) return;
    openModal({
      content: (
        <ContactSelectModal
          closeModal={closeModal}
          amount={contactModalAmount}
          method="Send"
          defaultContactId={toSendData?.id}
          setToSendData={handleContactSelection}
          prefetchedContacts={contacts}
          onSelectContact={handleContactSelection}
        />
      ),
      title: "Select Contact",
      description: "Choose a contact to send TCOIN to.",
    });
  };

  const clearRecipient = () => {
    setToSendData(null);
    setTimeout(() => amountInputRef.current?.focus(), 0);
  };

  const trimmedRecipientQuery = recipientQuery.trim().toLowerCase();
  const matchingContacts = useMemo(() => {
    if (!contacts || trimmedRecipientQuery === "") {
      return [];
    }

    return contacts.filter((contact) => {
      const fullName = contact.full_name?.toLowerCase() ?? "";
      const username = contact.username?.toLowerCase() ?? "";
      return (
        fullName.includes(trimmedRecipientQuery) ||
        username.includes(trimmedRecipientQuery)
      );
    });
  }, [contacts, trimmedRecipientQuery]);

  const focusRecipientField = () => {
    recipientInputRef.current?.focus();
  };

  const focusSendButton = () => {
    sendButtonRef.current?.focus();
  };

  const handleAmountAdvance = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      if (toSendData) {
        event.preventDefault();
        focusSendButton();
        return;
      }

      if (hasAmountForAdvance) {
        event.preventDefault();
        focusRecipientField();
      }
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col space-y-4">
      <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Amount</h2>
          {amountHeaderActions && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              {amountHeaderActions}
            </div>
          )}
        </div>
        <div className="relative mx-auto mt-4 flex w-full flex-col items-center gap-4 rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-6">
          <div className="w-full text-center">
            {isCadInput ? (
              <input
                ref={amountInputRef}
                className="w-full bg-transparent text-center font-bold leading-tight focus:outline-none"
                name="cad"
                value={displayValue}
                onChange={amountLocked ? undefined : handleCadChange}
                onFocus={() => setIsCadFocused(true)}
                onBlur={() => {
                  setIsCadFocused(false);
                  handleCadBlur();
                }}
                onKeyDown={handleAmountAdvance}
                readOnly={amountLocked}
                placeholder="$0.00"
                style={{ fontSize }}
                aria-label="Amount in Canadian dollars"
              />
            ) : (
              <input
                ref={amountInputRef}
                className="w-full bg-transparent text-center font-bold leading-tight focus:outline-none"
                name="tcoin"
                value={displayValue}
                onChange={amountLocked ? undefined : handleTcoinChange}
                onFocus={() => setIsTcoinFocused(true)}
                onBlur={() => {
                  setIsTcoinFocused(false);
                  handleTcoinBlur();
                }}
                onKeyDown={handleAmountAdvance}
                readOnly={amountLocked}
                placeholder="0.00"
                style={{ fontSize }}
                aria-label="Amount in TCOIN"
              />
            )}
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Toggle between TCOIN and CAD"
              className="h-10 w-10 flex-shrink-0 rounded-full border border-border/60 [&_svg]:h-5 [&_svg]:w-5"
              onClick={() => {
                if (isCadInput) {
                  handleCadBlur();
                } else {
                  handleTcoinBlur();
                }
                setIsCadInput((prev) => !prev);
                setIsCadFocused(false);
                setIsTcoinFocused(false);
              }}
            >
              <LuRefreshCcw className="h-6 w-6" />
            </Button>
            <p className="flex-1 text-center text-sm text-muted-foreground">
              {isCadInput
                ? `≈ ${formatTcoinDisplay(tcoinAmount) || "0.00 TCOIN"}`
                : `≈ ${formatCadDisplay(cadAmount) || "$0.00"} CAD`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Available: {userBalance.toFixed(4)}</span>
              <Button
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={onUseMax}
                disabled={locked}
              >
                Use Max
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Send To</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={openContactSelector}
              disabled={locked}
            >
              <LuUserPlus className="mr-2 h-4 w-4" /> Select Contact
            </Button>
            {toSendData && !locked && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearRecipient}
                aria-label="Clear recipient"
              >
                <LuX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {toSendData ? (
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-background/70 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={toSendData.profile_image_url ?? undefined}
                alt={formatContactName(toSendData)}
              />
              <AvatarFallback>{getContactInitials(toSendData)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-base font-medium">{formatContactName(toSendData)}</p>
              {toSendData.username && (
                <p className="text-sm text-muted-foreground">@{toSendData.username}</p>
              )}
              {toSendData.wallet_address && (
                <p className="text-xs text-muted-foreground">
                  {toSendData.wallet_address.slice(0, 6)}…
                  {toSendData.wallet_address.slice(-4)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-background/70 p-5">
            <label htmlFor="recipient-search" className="mb-2 block text-sm font-medium text-muted-foreground">
              Recipient
            </label>
            <Input
              id="recipient-search"
              ref={recipientInputRef}
              placeholder="Start typing a name"
              value={recipientQuery}
              onChange={(event) => setRecipientQuery(event.target.value)}
              aria-label="Recipient search"
            />
            {trimmedRecipientQuery !== "" && matchingContacts.length > 0 && (
              <ul className="mt-3 space-y-2">
                {matchingContacts.map((contact) => {
                  const name = contact.full_name?.trim() || contact.username?.trim() || "Unknown";
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-left transition hover:border-primary"
                        onClick={() => handleContactRecordSelection(contact)}
                      >
                        <span className="text-sm font-medium">{name}</span>
                        {contact.username && (
                          <span className="text-xs text-muted-foreground">@{contact.username}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <Button
        ref={sendButtonRef}
        className={`w-full ${!canSend ? "cursor-not-allowed opacity-60" : ""}`}
        aria-disabled={!canSend}
        onClick={() => {
          if (!toSendData) {
            toast.error("Select a recipient first.");
            return;
          }
          if (!hasTcoinAmount) {
            toast.error("Please enter an amount greater than zero.");
            return;
          }
          if (!Number.isFinite(cadValue) && cadAmount.trim() !== "") {
            toast.error("Enter a valid CAD amount or switch currencies.");
            return;
          }
          if (amountExceedsBalance) {
            toast.error("Amount exceeds your available balance.");
            return;
          }
          openModal({
            content: (
              <ConfirmTransactionModal
                tcoinAmount={tcoinAmount}
                cadAmount={cadAmount}
                toSendData={toSendData}
                closeModal={closeModal}
                sendMoney={sendMoney}
                setExplorerLink={setExplorerLink}
                getLastTransferRecord={getLastTransferRecord}
                onPaymentComplete={onPaymentComplete}
              />
            ),
            title: "Confirm Payment",
          });
        }}
      >
        <LuSend className="mr-2 h-4 w-4" /> {actionLabel}
      </Button>

      {explorerLink && (
        <div className="rounded-lg bg-green-900/20 p-4">
          <div className="space-y-4 text-center">
            <>
              <h3 className="text-lg font-bold text-green-400">Success!</h3>
              <a
                href={explorerLink}
                className="block text-blue-400 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Transaction on Explorer
              </a>
            </>
            {!connections?.[0] && toSendData && (
              <div className="border-t border-gray-700 pt-4">
                <p>Add to Contacts?</p>
                <div className="mt-2 flex justify-center gap-4">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      try {
                        await supabase
                          .from("connections")
                          .update({ state: "added" })
                          .match({
                            connected_user_id: toSendData.id,
                            owner_user_id: userData?.cubidData?.id,
                          });
                        await supabase
                          .from("connections")
                          .update({ state: "added" })
                          .match({
                            owner_user_id: toSendData.id,
                            connected_user_id: userData?.cubidData?.id,
                          });
                        toast.success("Contact added!");
                      } catch (err) {
                        console.error("add contact error", err);
                      }
                    }}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      try {
                        await supabase
                          .from("connections")
                          .update({ state: "removed" })
                          .match({
                            connected_user_id: toSendData.id,
                            owner_user_id: userData?.cubidData?.id,
                          });
                        await supabase
                          .from("connections")
                          .update({ state: "removed" })
                          .match({
                            owner_user_id: toSendData.id,
                            connected_user_id: userData?.cubidData?.id,
                          });
                        toast.success("Contact removed!");
                      } catch (err) {
                        console.error("remove contact error", err);
                      }
                    }}
                  >
                    No
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmTransactionModal({
  tcoinAmount,
  cadAmount,
  toSendData,
  closeModal,
  sendMoney,
  setExplorerLink,
  getLastTransferRecord,
  onPaymentComplete,
}: {
  tcoinAmount: string;
  cadAmount: string;
  toSendData: Hypodata;
  closeModal: () => void;
  sendMoney: (amount: string) => Promise<string>;
  setExplorerLink: (link: string | null) => void;
  getLastTransferRecord?: () => TransferRecordSnapshot | null;
  onPaymentComplete?: (details: PaymentCompletionDetails) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { userData } = useAuth();
  const formattedTcoin = formatTcoinDisplay(tcoinAmount) || "0.00 TCOIN";
  const formattedCad = formatCadDisplay(cadAmount) || "$0.00";

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-bold">Confirm Transaction</h3>
      <div className="space-y-2">
        <p>Amount: {formattedTcoin} ({formattedCad} CAD)</p>
        <p>Recipient: {toSendData?.full_name}</p>
      </div>
      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={closeModal}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true);
            try {
              const hash = await sendMoney(tcoinAmount);
              insertSuccessNotification({
                user_id: userData?.cubidData?.id,
                notification: `You sent ${tcoinAmount}`,
              });
              insertSuccessNotification({
                user_id: toSendData.id,
                notification: `You received ${tcoinAmount}`,
              });
              const isValidHash = typeof hash === "string" && hash.trim() !== "";
              if (isValidHash) {
                const trimmedHash = hash.trim();
                setExplorerLink(`https://evm-testnet.flowscan.io/tx/${trimmedHash}`);
                const snapshot = getLastTransferRecord?.() ?? null;
                const completionDetails: PaymentCompletionDetails = {
                  transactionHash: trimmedHash,
                };
                if (snapshot) {
                  if (snapshot.transactionId != null) {
                    completionDetails.transactionId = snapshot.transactionId;
                  }
                  completionDetails.transferRecord = snapshot.raw;
                }
                await onPaymentComplete?.(completionDetails);
              } else {
                setExplorerLink(null);
              }
              toast.success("Payment Sent Successfully!");
            } catch (error) {
              toast.error("Error sending payment!");
            } finally {
              setIsLoading(false);
              closeModal();
            }
          }}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
