import React from "react";
import QRCode from "react-qr-code";
import { LuShare2, LuUsers, LuX } from "react-icons/lu";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import useDarkMode from "@shared/hooks/useDarkMode";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { cn } from "@shared/utils/classnames";
import { ContactSelectModal, ShareQrModal } from "@tcoin/wallet/components/modals";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Hypodata } from "./types";
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
}) {
  const { isDarkMode } = useDarkMode();
  const { ...rest } = useTokenBalance(senderWallet);
  const { openModal, closeModal } = useModal();

  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };
  const balance = formatNumber(rest.balance.toString(), false);

  const handleRequestClick = () => {
    const requestedAmount = parseFloat(qrTcoinAmount);
    const availableBalance = parseFloat(rest.balance);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
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
      description: `Select a contact to request ${tokenLabel.toUpperCase()} from.`,
    });
  };

  const rawAmount = qrTcoinAmount?.trim() ?? "";
  const cleanedAmount = rawAmount.replace(/\s*TCOIN\s*$/i, "").trim();
  const hasAmount = cleanedAmount !== "" && cleanedAmount !== "0.00";
  const qrCaption = hasAmount
    ? `Receive ${cleanedAmount} ${tokenLabel.toUpperCase()}`
    : `Receive any amount ${tokenLabel.toUpperCase()}`;

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
          {qrCodeData ? (
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
            <p className="text-white">Loading QR Code...</p>
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
            onClick={() => {
              openModal({
                content: <ShareQrModal qrCodeData={qrCodeData} closeModal={closeModal} />,
                title: "Share QR Code",
                description: "Share your QR code via different methods.",
              });
            }}
          >
            <LuShare2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Balance: {balance}</p>
      </CardContent>
    </Card>
  );
}
