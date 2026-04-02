import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import {
  cancelPaymentRequest,
  createPaymentRequest,
  getOutgoingPaymentRequests,
} from "@shared/lib/edge/paymentRequestsClient";
import {
  createPaymentRequestLink,
} from "@shared/lib/edge/paymentRequestLinksClient";
import type { PaymentRequestLinkMode } from "@shared/lib/edge/paymentRequestLinks";
import { ReceiveCard } from "./ReceiveCard";
import { Hypodata, InvoicePayRequest } from "./types";
import type { ContactRecord } from "@shared/api/services/supabaseService";

interface ReceiveTabProps {
  contact?: Hypodata | null;
  onContactChange?: (contact: Hypodata | null) => void;
  contacts?: ContactRecord[];
  showQrCode?: boolean;
}

export function ReceiveTab({
  contact,
  onContactChange,
  contacts,
  showQrCode = true,
}: ReceiveTabProps) {
  const { authData, userData, isLoadingUser } = useAuth();
  const { exchangeRate } = useControlVariables();

  const user_id = userData?.cubidData.id;
  const [qrCodeData, setQrCodeData] = useState("");
  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
  const [qrLinkMode, setQrLinkMode] = useState<PaymentRequestLinkMode>("rotating_multi_use");
  const [qrLinkExpiresAt, setQrLinkExpiresAt] = useState<string | null>(null);
  const [isGeneratingQrLink, setIsGeneratingQrLink] = useState(false);
  const [qrLinkError, setQrLinkError] = useState<string | null>(null);
  const [requestContact, setRequestContact] = useState<Hypodata | null>(
    contact ?? null
  );
  const [openRequests, setOpenRequests] = useState<InvoicePayRequest[]>([]);

  const parsePositiveAmount = useCallback((value: string) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, []);

  const requestedAmount = parsePositiveAmount(qrTcoinAmount);
  const shouldGenerateQrLink = Boolean(authData?.user) && showQrCode && !requestContact;

  const mintQrLink = useCallback(
    async (mode: PaymentRequestLinkMode) => {
      if (!authData?.user) {
        setQrCodeData("");
        setQrLinkExpiresAt(null);
        return;
      }

      setIsGeneratingQrLink(true);
      try {
        const { link } = await createPaymentRequestLink({
          amountRequested: requestedAmount,
          mode,
          appContext: { citySlug: "tcoin" },
        });
        setQrCodeData(link.url ?? "");
        setQrLinkExpiresAt(link.expiresAt);
        setQrLinkError(null);
      } catch (error) {
        console.error("Failed to create payment request link:", error);
        setQrCodeData("");
        setQrLinkExpiresAt(null);
        setQrLinkError("Unable to generate a pay link right now.");
      } finally {
        setIsGeneratingQrLink(false);
      }
    },
    [authData?.user, requestedAmount]
  );

  useEffect(() => {
    if (!shouldGenerateQrLink) {
      setQrCodeData("");
      setQrLinkExpiresAt(null);
      return;
    }

    void mintQrLink(qrLinkMode);

    if (qrLinkMode !== "rotating_multi_use") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void mintQrLink("rotating_multi_use");
    }, 45_000);

    return () => window.clearInterval(intervalId);
  }, [mintQrLink, qrLinkMode, shouldGenerateQrLink]);

  const handleQrTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setQrTcoinAmount(raw);
    const num = parseFloat(raw) || 0;
    setQrCadAmount((num * exchangeRate).toString());
  };

  const handleQrCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setQrCadAmount(raw);
    const num = parseFloat(raw) || 0;
    setQrTcoinAmount((num / exchangeRate).toString());
  };

  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  const handleQrTcoinBlur = () => {
    const num = parseFloat(qrTcoinAmount) || 0;
    setQrTcoinAmount(formatNumber(qrTcoinAmount, false));
    setQrCadAmount(formatNumber((num * exchangeRate).toString(), true));
  };

  const handleQrCadBlur = () => {
    const num = parseFloat(qrCadAmount) || 0;
    setQrCadAmount(formatNumber(qrCadAmount, true));
    setQrTcoinAmount(formatNumber((num / exchangeRate).toString(), false));
  };

  useEffect(() => {
    setRequestContact(contact ?? null);
  }, [contact]);

  const fetchOpenRequests = useCallback(async () => {
    if (!user_id) {
      setOpenRequests([]);
      return;
    }

    try {
      const body = await getOutgoingPaymentRequests({
        appContext: { citySlug: "tcoin" },
      });
      setOpenRequests(body.requests as InvoicePayRequest[]);
    } catch (error) {
      console.error("Failed to fetch open requests:", error);
    }
  }, [user_id]);

  useEffect(() => {
    void fetchOpenRequests();
  }, [fetchOpenRequests]);

  const handleCreateShareableRequest = useCallback(
    async (amount: number) => {
      if (!user_id) {
        return null;
      }

      try {
        const { request } = await createPaymentRequest({
          requestFrom: null,
          amountRequested: amount,
          appContext: { citySlug: "tcoin" },
        });
        await fetchOpenRequests();
        return request as InvoicePayRequest;
      } catch (error) {
        console.error("Failed to create shareable request:", error);
        throw error;
      }
    },
    [fetchOpenRequests, user_id]
  );

  const handleCreateTargetedRequest = useCallback(
    async (
      contactToRequest: Hypodata,
      amount: number,
      _formattedAmount: string
    ) => {
      if (!user_id || !contactToRequest?.id) {
        throw new Error("Missing request context");
      }

      try {
        const { request } = await createPaymentRequest({
          requestFrom: contactToRequest.id,
          amountRequested: amount,
          appContext: { citySlug: "tcoin" },
        });

        await fetchOpenRequests();
        setQrTcoinAmount("");
        setQrCadAmount("");

        return request as InvoicePayRequest;
      } catch (error) {
        console.error("Failed to create targeted request:", error);
        throw error;
      }
    },
    [fetchOpenRequests, user_id]
  );

  const handleDeactivateRequest = useCallback(
    async (requestId: number) => {
      try {
        await cancelPaymentRequest({
          requestId,
          appContext: { citySlug: "tcoin" },
        });

        setOpenRequests((previous) =>
          previous.filter((request) => request.id !== requestId)
        );
        await fetchOpenRequests();
      } catch (error) {
        console.error("Failed to deactivate request:", error);
        throw error;
      }
    },
    [fetchOpenRequests]
  );

  const handleRequestContactChange = (next: Hypodata | null) => {
    setRequestContact(next);
    onContactChange?.(next);
    void fetchOpenRequests();
  };

  return (
    <div className="mx-auto w-full">
      <ReceiveCard
        qrCodeData={qrCodeData}
        qrTcoinAmount={qrTcoinAmount}
        qrCadAmount={qrCadAmount}
        qrLinkMode={qrLinkMode}
        qrLinkExpiresAt={qrLinkExpiresAt}
        isGeneratingQrCode={isGeneratingQrLink}
        onSwitchQrLinkMode={setQrLinkMode}
        handleQrTcoinChange={handleQrTcoinChange}
        handleQrCadChange={handleQrCadChange}
        senderWallet=""
        handleQrTcoinBlur={handleQrTcoinBlur}
        handleQrCadBlur={handleQrCadBlur}
        tokenLabel="TCOIN"
        qrBgColor="#fff"
        qrFgColor="#000"
        qrWrapperClassName="bg-white p-1"
        qrUnavailableReason={
          isLoadingUser && !authData?.user
            ? "QR code is still loading your wallet session."
            : qrLinkError
        }
        requestContact={requestContact}
        onClearRequestContact={() => handleRequestContactChange(null)}
        contacts={contacts}
        onSelectRequestContact={(selectedContact) =>
          handleRequestContactChange(selectedContact)
        }
        openRequests={openRequests}
        onCreateShareableRequest={handleCreateShareableRequest}
        onCreateTargetedRequest={handleCreateTargetedRequest}
        onDeleteRequest={handleDeactivateRequest}
        showQrCode={showQrCode}
      />
    </div>
  );
}
