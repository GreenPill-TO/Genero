import React from "react";
import QRCode from "react-qr-code";
import { LuShare2, LuUsers, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";
import { ContactSelectModal, ShareQrModal } from "@tcoin/wallet/components/modals";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Hypodata, InvoicePayRequest } from "./types";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import type { PaymentRequestLinkMode } from "@shared/lib/edge/paymentRequestLinks";
import { walletPanelClass, walletPanelMutedClass } from "./authenticated-ui";

export function ReceiveCard({
  qrCodeData,
  qrTcoinAmount,
  qrCadAmount,
  qrLinkMode = "rotating_multi_use",
  qrLinkExpiresAt = null,
  isGeneratingQrCode = false,
  onSwitchQrLinkMode,
  handleQrTcoinChange,
  handleQrCadChange,
  senderWallet,
  handleQrTcoinBlur,
  handleQrCadBlur,
  qrBgColor,
  qrFgColor,
  qrWrapperClassName,
  qrUnavailableReason = null,
  tokenLabel = "Tcoin",
  requestContact = null,
  onClearRequestContact,
  contacts,
  onSelectRequestContact,
  openRequests = [],
  onCreateShareableRequest,
  onCreateTargetedRequest,
  onDeleteRequest,
  showQrCode = true,
}: {
  qrCodeData: string;
  qrTcoinAmount: string;
  qrCadAmount: string;
  qrLinkMode?: PaymentRequestLinkMode;
  qrLinkExpiresAt?: string | null;
  isGeneratingQrCode?: boolean;
  onSwitchQrLinkMode?: (mode: PaymentRequestLinkMode) => void;
  handleQrTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQrCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  senderWallet: string;
  handleQrTcoinBlur: any;
  handleQrCadBlur: any;
  qrBgColor?: string;
  qrFgColor?: string;
  qrWrapperClassName?: string;
  qrUnavailableReason?: string | null;
  tokenLabel?: string;
  requestContact?: Hypodata | null;
  onClearRequestContact?: () => void;
  contacts?: ContactRecord[];
  onSelectRequestContact?: (contact: Hypodata) => void;
  openRequests?: InvoicePayRequest[];
  onCreateShareableRequest?: (amount: number) => Promise<InvoicePayRequest | null>;
  onCreateTargetedRequest?: (
    contact: Hypodata,
    amount: number,
    formattedAmount: string
  ) => Promise<InvoicePayRequest | null>;
  onDeleteRequest?: (requestId: number) => Promise<void>;
  showQrCode?: boolean;
}) {
  const { openModal, closeModal } = useModal();
  void senderWallet;

  const uppercaseToken = tokenLabel.toUpperCase();

  const parseAmountFromString = (
    value: string,
    options: { allowZero?: boolean } = {}
  ): number | null => {
    const { allowZero = false } = options;
    if (typeof value !== "string") {
      return null;
    }
    const cleaned = value.replace(/,/g, "");
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseFloat(match[0]);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (allowZero) {
      return parsed < 0 ? null : parsed;
    }
    return parsed <= 0 ? null : parsed;
  };

  const normaliseAmount = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
  };

  const formatRequestAmount = (amount: number | null) => {
    if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
      return `0.00 ${uppercaseToken}`;
    }
    return `${(amount ?? 0).toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${uppercaseToken}`;
  };

  const formatCadAmount = (amount: number | null) => {
    if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
      return "$0.00";
    }
    return `$${(amount ?? 0).toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const describeRequestAmount = (amount: number | null) => {
    if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
      return {
        label: `Any amount ${uppercaseToken}`,
        note: "Variable amount request",
      };
    }
    return {
      label: formatRequestAmount(amount),
      note: null,
    };
  };

  const formatSavedRequestTimestamp = (value: string) => {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    const dateLabel = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsedDate);

    const timeParts = new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(parsedDate);

    const hour = timeParts.find((part) => part.type === "hour")?.value ?? "";
    const minute = timeParts.find((part) => part.type === "minute")?.value ?? "";
    const dayPeriod = (
      timeParts.find((part) => part.type === "dayPeriod")?.value ?? ""
    )
      .replace(/\./g, "")
      .toLowerCase();

    if (!hour || !minute) {
      return `Saved ${dateLabel}`;
    }

    return `Saved ${dateLabel} at ${hour}.${minute}${dayPeriod ? ` ${dayPeriod}` : ""}`;
  };

  const contactNamesById = React.useMemo(() => {
    const map = new Map<number, string>();
    (contacts ?? []).forEach((contact) => {
      const name = contact.full_name?.trim();
      const username = contact.username?.trim();
      if (name) {
        map.set(contact.id, name);
      } else if (username) {
        map.set(contact.id, `@${username}`);
      } else {
        map.set(contact.id, `User #${contact.id}`);
      }
    });
    return map;
  }, [contacts]);

  const getContactLabel = (id: number | null | undefined) => {
    if (typeof id !== "number" || !Number.isFinite(id)) {
      return null;
    }
    return contactNamesById.get(id) ?? `User #${id}`;
  };

  const shareableRequests = React.useMemo(
    () => openRequests.filter((request) => request.requestFrom == null),
    [openRequests]
  );

  const targetedRequests = React.useMemo(
    () => openRequests.filter((request) => request.requestFrom != null),
    [openRequests]
  );

  const openShareModal = () => {
    openModal({
      content: <ShareQrModal qrCodeData={qrCodeData} closeModal={closeModal} />,
      title: "Share QR Code",
      description: "Share your QR code via different methods.",
    });
  };

  const handleShareableRequest = async () => {
    const parsedAmount = parseAmountFromString(qrTcoinAmount);

    if (!parsedAmount) {
      toast.error("Enter an amount greater than zero to create a shareable request.");
      return;
    }

    if (!onCreateShareableRequest) {
      openShareModal();
      return;
    }

    try {
      await onCreateShareableRequest(parsedAmount);
      toast.success(`Request for ${formatRequestAmount(parsedAmount)} has been saved.`);
      openShareModal();
    } catch (error) {
      console.error("Unable to save shareable request:", error);
      toast.error("Failed to save the request.");
    }
  };

  const handleDeleteRequest = async (request: InvoicePayRequest) => {
    if (!onDeleteRequest) return;
    try {
      await onDeleteRequest(request.id);
      toast.success("Request removed.");
    } catch (error) {
      console.error("Failed to delete request:", error);
      toast.error("Failed to delete the request. Please try again.");
    }
  };

  const hasOpenRequests =
    shareableRequests.length > 0 || targetedRequests.length > 0;

  const handleRequestClick = () => {
    openModal({
      content: (
        <ContactSelectModal
          closeModal={closeModal}
          amount={qrTcoinAmount}
          method="Request"
          defaultContactId={requestContact?.id}
          prefetchedContacts={contacts}
          onSelectContact={(contact) => onSelectRequestContact?.(contact)}
        />
      ),
      title: "Request from Contact",
      description: `Select a contact to request ${uppercaseToken} from.`,
    });
  };

  const parsedQrTcoinAmount = parseAmountFromString(qrTcoinAmount);
  const parsedQrCadAmount = parseAmountFromString(qrCadAmount);
  const qrCaption = parsedQrTcoinAmount
    ? `Receive ${formatRequestAmount(parsedQrTcoinAmount)}${
        parsedQrCadAmount ? ` (${formatCadAmount(parsedQrCadAmount)})` : ""
      }`
    : "Receive any amount";
  const qrModeLabel =
    qrLinkMode === "single_use" ? "Long-lived one-time QR" : "Rotating secure QR";
  const qrModeDescription =
    qrLinkMode === "single_use"
      ? "This QR code will work only once."
      : "This QR code can be shown to multiple people.";
  const qrExpiryLabel = React.useMemo(() => {
    if (!qrLinkExpiresAt) {
      return null;
    }

    if (qrLinkMode === "rotating_multi_use") {
      return "Expires within 60 seconds";
    }

    const expiresAtMs = Date.parse(qrLinkExpiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return null;
    }

    const remainingDays = Math.max(
      1,
      Math.ceil((expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000))
    );

    return `Expires in ${remainingDays} ${remainingDays === 1 ? "day" : "days"}`;
  }, [qrLinkExpiresAt, qrLinkMode]);

  const formatContactName = (contact: Hypodata) =>
    contact.full_name?.trim() || contact.username?.trim() || "Unknown";

  const buildReviewState = () => {
    if (!requestContact) {
      return { warnings: [] as string[], limitExceeded: false };
    }

    const warnings: string[] = [];
    let limitExceeded = false;
    const parsedAmount =
      parseAmountFromString(qrTcoinAmount, { allowZero: true }) ?? 0;

    if (parsedAmount === 0) {
      warnings.push("The amount requested is currently 0 TCOIN.");
    }

    if (requestContact.id != null) {
        let existingRequestCount = 0;
        targetedRequests.forEach((request) => {
        if (request.requestFrom == null) return;
        const recipientId = Number(request.requestFrom);
        if (Number.isFinite(recipientId) && recipientId === requestContact.id) {
          existingRequestCount += 1;
        }
      });

      if (existingRequestCount >= 3) {
        limitExceeded = true;
        warnings.push(
          `You already have 3 open requests for ${formatContactName(requestContact)}. Please resolve them before sending another.`
        );
      } else if (existingRequestCount > 0) {
        const requestLabel =
          existingRequestCount === 1
            ? "1 open request"
            : `${existingRequestCount} open requests`;
        warnings.push(
          `You already have ${requestLabel} for ${formatContactName(requestContact)}.`
        );
      }
    }

    return { warnings, limitExceeded };
  };

  const openReviewModal = () => {
    if (!requestContact) return;

    const parsedAmount =
      parseAmountFromString(qrTcoinAmount, { allowZero: true }) ?? 0;
    const parsedCad = parseAmountFromString(qrCadAmount, { allowZero: true });
    const formattedAmount = formatRequestAmount(parsedAmount);
    const formattedCad = formatCadAmount(parsedCad);
    const contactLabel = formatContactName(requestContact);

    const handleConfirm = async () => {
      if (!onCreateTargetedRequest) {
        toast.error("Targeted requests are unavailable right now.");
        return;
      }

      try {
        await onCreateTargetedRequest(requestContact, parsedAmount, formattedAmount);
        onClearRequestContact?.();
        closeModal();
        toast.success(
          `Request for ${formattedAmount} sent to ${contactLabel}.`
        );
      } catch (error) {
        console.error("Failed to create targeted request:", error);
        toast.error("Failed to create the request. Please try again.");
      }
    };

    openModal({
      title: "Review Request",
      description: "Confirm the details before creating your request.",
      content: (
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Amount</span>
              <span>{formattedAmount}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Value (CAD)</span>
              <span>{formattedCad}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Recipient</span>
              <span>{contactLabel}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Creating this request will add a notification for the recipient to
            see the next time they log in. They may also receive an email if
            they have emails enabled.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Create Request</Button>
          </div>
        </div>
      ),
    });
  };

  const handleReviewClick = () => {
    const { warnings, limitExceeded } = buildReviewState();

    if (limitExceeded) {
      openModal({
        title: "Resolve open requests",
        description:
          "You have reached the limit of open requests for this recipient.",
        content: (
          <div className="space-y-4">
            {warnings.length > 0 && (
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button onClick={closeModal}>Go back</Button>
            </div>
          </div>
        ),
      });
      return;
    }

    if (warnings.length === 0) {
      openReviewModal();
      return;
    }

    openModal({
      title: "Check request details",
      description: "Please acknowledge the following before continuing.",
      content: (
        <div className="space-y-4">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Go back
            </Button>
            <Button
              onClick={() => {
                closeModal();
                openReviewModal();
              }}
            >
              Continue to Review
            </Button>
          </div>
        </div>
      ),
    });
  };

  const shouldShowQrCode = showQrCode && !requestContact;

  return (
    <section className={`${walletPanelClass} space-y-5`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Receive money
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Receive</h2>
      </div>
      <div
        data-testid="receive-layout"
        className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start"
      >
        <div className="space-y-4">
          <div
            data-testid="receive-qr-stage"
            className={cn(
              "relative mx-auto flex aspect-square w-full max-w-[26rem] flex-col items-center justify-center gap-3 rounded-[24px] bg-white p-4 text-slate-950 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] transition duration-500 hover:scale-[1.01] sm:p-5",
              qrWrapperClassName
            )}
          >
            {shouldShowQrCode ? (
              qrCodeData ? (
                <>
                  <div className="space-y-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700">
                      {qrModeLabel}
                    </p>
                    {qrExpiryLabel ? (
                      <p className="text-xs text-slate-700">{qrExpiryLabel}</p>
                    ) : null}
                  </div>
                  <p className="text-center text-base font-semibold text-slate-950">
                    {qrCaption}
                  </p>
                  <QRCode
                    value={qrCodeData}
                    size={250}
                    bgColor={qrBgColor ?? "transparent"}
                    fgColor={qrFgColor ?? "#000"}
                  />
                  <div className="space-y-2 text-center">
                    <p className="text-xs text-slate-700">{qrModeDescription}</p>
                    {onSwitchQrLinkMode ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-900 underline underline-offset-4"
                        onClick={() =>
                          onSwitchQrLinkMode(
                            qrLinkMode === "single_use"
                              ? "rotating_multi_use"
                              : "single_use"
                          )
                        }
                      >
                        {qrLinkMode === "single_use"
                          ? "Back to rotating QR"
                          : "Switch to long-lived QR"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : qrUnavailableReason ? (
                <p className="text-center text-sm text-slate-700">{qrUnavailableReason}</p>
              ) : (
                <p className="text-center text-sm text-slate-700">
                  {isGeneratingQrCode ? "Generating pay link..." : "Loading QR Code..."}
                </p>
              )
            ) : (
              <p className="text-center text-sm text-slate-700">
              QR code hidden while preparing a direct contact request.
            </p>
          )}
          </div>
        </div>
        <div className="space-y-4">
          <div
            data-testid="receive-controls"
            className={`${walletPanelMutedClass} space-y-3`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{tokenLabel}</p>
            </div>
            <Input
              name="qrTcoin"
              elSize="md"
              label={tokenLabel}
              className="wallet-auth-input h-12 w-full rounded-2xl"
              value={qrTcoinAmount}
              onChange={handleQrTcoinChange}
              onBlur={handleQrTcoinBlur}
              placeholder={`Enter ${tokenLabel.toUpperCase()} amount`}
            />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cad</p>
            <Input
              name="qrCad"
              elSize="md"
              label="Cad"
              className="wallet-auth-input h-12 w-full rounded-2xl"
              value={qrCadAmount}
              onChange={handleQrCadChange}
              onBlur={handleQrCadBlur}
              placeholder="Enter CAD amount"
            />
          </div>
          {requestContact && (
            <div className={walletPanelMutedClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage
                      src={requestContact.profile_image_url ?? undefined}
                      alt={formatContactName(requestContact)}
                    />
                    <AvatarFallback>
                      {formatContactName(requestContact).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Request From:
                    </p>
                    <p className="text-sm font-medium">
                      {formatContactName(requestContact)}
                    </p>
                    {requestContact.username && (
                      <p className="text-xs text-muted-foreground">
                        @{requestContact.username}
                      </p>
                    )}
                  </div>
                </div>
                {onClearRequestContact && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClearRequestContact}
                    aria-label="Clear request contact"
                  >
                    <LuX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row lg:flex-col xl:flex-row">
            {requestContact ? (
              <Button className="flex-1" onClick={handleReviewClick}>
                Review Request
              </Button>
            ) : (
              <>
                <Button className="flex-1" onClick={handleRequestClick}>
                  <LuUsers className="mr-2 h-4 w-4" /> Request from Contact
                </Button>
                <Button className="flex-1" onClick={handleShareableRequest}>
                  <LuShare2 className="mr-2 h-4 w-4" /> Create a shareable request
                </Button>
              </>
            )}
          </div>
          {hasOpenRequests && (
            <div className={`${walletPanelMutedClass} space-y-4`}>
              <h3 className="text-sm font-semibold">Payment requests I have sent</h3>
              {shareableRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Shareable
                  </p>
                  {shareableRequests.map((request) => {
                    const amountValue = normaliseAmount(request.amountRequested);
                    const { label, note } = describeRequestAmount(amountValue);
                    return (
                      <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background/80 p-3">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          {note && (
                            <p className="text-xs text-muted-foreground">{note}</p>
                          )}
                          {request.createdAt && (
                            <p className="text-xs text-muted-foreground">
                              {formatSavedRequestTimestamp(request.createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={openShareModal}>
                            Share
                          </Button>
                          {onDeleteRequest && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                void handleDeleteRequest(request);
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {targetedRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    To Contacts
                  </p>
                  {targetedRequests.map((request) => {
                    const amountValue = normaliseAmount(request.amountRequested);
                    const recipientLabel = getContactLabel(request.requestFrom ?? null);
                    const { label, note } = describeRequestAmount(amountValue);
                    return (
                      <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background/80 p-3">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          {note && (
                            <p className="text-xs text-muted-foreground">{note}</p>
                          )}
                          {recipientLabel && (
                            <p className="text-xs text-muted-foreground">
                              Request sent to {recipientLabel}
                            </p>
                          )}
                        </div>
                        {onDeleteRequest && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              void handleDeleteRequest(request);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
