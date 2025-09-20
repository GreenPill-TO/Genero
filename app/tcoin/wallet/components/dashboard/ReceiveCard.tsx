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
  showQrCode?: boolean;
}) {
  const { isDarkMode } = useDarkMode();
  const { openModal, closeModal } = useModal();
  void senderWallet;

  const uppercaseToken = tokenLabel.toUpperCase();

  const parseAmountFromString = (value: string): number | null => {
    if (typeof value !== "string") {
      return null;
    }
    const cleaned = value.replace(/,/g, "");
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseFloat(match[0]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
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
          {showQrCode ? (
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
          <Button className="flex-1" onClick={handleRequestClick}>
            <LuUsers className="mr-2 h-4 w-4" /> Request from Contact
          </Button>
          <Button
            className="flex-1"
            onClick={handleShareableRequest}
          >
            <LuShare2 className="mr-2 h-4 w-4" /> Create a shareable request
          </Button>
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
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/80 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {formatRequestAmount(amountValue)}
                        </p>
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
                  return (
                    <div
                      key={request.id}
                      className="rounded-xl border border-border/50 bg-background/80 p-3"
                    >
                      <p className="text-sm font-medium">
                        {formatRequestAmount(amountValue)}
                      </p>
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
