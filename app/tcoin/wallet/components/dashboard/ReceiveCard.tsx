import React from "react";
import QRCode from "react-qr-code";
import { LuShare2, LuUsers, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import useDarkMode from "@shared/hooks/useDarkMode";
import { cn } from "@shared/utils/classnames";
import { ContactSelectModal, ShareQrModal } from "@tcoin/wallet/components/modals";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Hypodata, InvoicePayRequest } from "./types";
import type { ContactRecord } from "@shared/api/services/supabaseService";

export function ReceiveCard({
  qrCodeData,
  qrTcoinAmount,
  qrCadAmount,
  handleQrTcoinChange,
  handleQrCadChange,
  senderWallet,
  handleQrTcoinBlur,
  handleQrCadBlur,
  qrBgColor,
  qrFgColor,
  qrWrapperClassName,
  tokenLabel = "Tcoin",
  requestContact = null,
  onClearRequestContact,
  contacts,
  onSelectRequestContact,
  openRequests = [],
  onCreateShareableRequest,
  onCreateTargetedRequest,
  showQrCode = true,
}: {
  qrCodeData: string;
  qrTcoinAmount: string;
  qrCadAmount: string;
  handleQrTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQrCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  senderWallet: string;
  handleQrTcoinBlur: any;
  handleQrCadBlur: any;
  qrBgColor?: string;
  qrFgColor?: string;
  qrWrapperClassName?: string;
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
  showQrCode?: boolean;
}) {
  const { isDarkMode } = useDarkMode();
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
    () => openRequests.filter((request) => request.request_from == null),
    [openRequests]
  );

  const targetedRequests = React.useMemo(
    () => openRequests.filter((request) => request.request_from != null),
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

  const rawAmount = qrTcoinAmount?.trim() ?? "";
  const cleanedAmount = rawAmount
    .replace(new RegExp(`\\s*${uppercaseToken}\\s*$`, "i"), "")
    .trim();
  const hasAmount = cleanedAmount !== "" && cleanedAmount !== "0.00";
  const qrCaption = hasAmount
    ? `Receive ${cleanedAmount} ${uppercaseToken}`
    : `Receive any amount ${uppercaseToken}`;

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
        if (request.request_from == null) return;
        const recipientId = Number(request.request_from);
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
    <Card>
      <CardHeader>
        <CardTitle>Receive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 mt-[-10px]">
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl transform transition duration-500 hover:scale-105",
            qrWrapperClassName ?? "p-2"
          )}
        >
          {shouldShowQrCode ? (
            qrCodeData ? (
              <>
                <p className="mb-3 text-center text-base font-semibold text-gray-900">
                  {qrCaption}
                </p>
                <QRCode
                  value={qrCodeData}
                  size={250}
                  bgColor={qrBgColor ?? "transparent"}
                  fgColor={qrFgColor ?? (isDarkMode ? "#fff" : "#000")}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading QR Code...</p>
            )
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              QR code hidden while preparing a direct contact request.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p>{tokenLabel}</p>
          <Input
            name="qrTcoin"
            elSize="md"
            label={tokenLabel}
            className="w-full"
            value={qrTcoinAmount}
            onChange={handleQrTcoinChange}
            onBlur={handleQrTcoinBlur}
            placeholder={`Enter ${tokenLabel.toUpperCase()} amount`}
          />
          <p>Cad</p>
          <Input
            name="qrCad"
            elSize="md"
            label="Cad"
            className="w-full"
            value={qrCadAmount}
            onChange={handleQrCadChange}
            onBlur={handleQrCadBlur}
            placeholder="Enter CAD amount"
          />
        </div>
        {requestContact && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
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
        <div className="flex flex-col gap-4 sm:flex-row">
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
          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4">
            <h3 className="text-sm font-semibold">Open Requests</h3>
            {shareableRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Shareable
                </p>
                {shareableRequests.map((request) => {
                  const amountValue = normaliseAmount(request.amount_requested);
                  const { label, note } = describeRequestAmount(amountValue);
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/80 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        {note && (
                          <p className="text-xs text-muted-foreground">{note}</p>
                        )}
                        {request.created_at && (
                          <p className="text-xs text-muted-foreground">
                            Saved {new Date(request.created_at).toLocaleDateString("en-CA")}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={openShareModal}>
                        Share
                      </Button>
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
                  const amountValue = normaliseAmount(request.amount_requested);
                  const recipientLabel = getContactLabel(request.request_from ?? null);
                  const { label, note } = describeRequestAmount(amountValue);
                  return (
                    <div
                      key={request.id}
                      className="rounded-xl border border-border/50 bg-background/80 p-3"
                    >
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
