import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import {
  cancelPaymentRequest,
  createPaymentRequest,
  getOutgoingPaymentRequests,
} from "@shared/lib/edge/paymentRequestsClient";
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
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();

  const user_id = userData?.cubidData.id;
  const nano_id = userData?.cubidData.user_identifier;
  const [qrCodeData, setQrCodeData] = useState("");
  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
  const [requestContact, setRequestContact] = useState<Hypodata | null>(
    contact ?? null
  );
  const [openRequests, setOpenRequests] = useState<InvoicePayRequest[]>([]);

  useEffect(() => {
    if (!user_id) return;
    setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    const interval = setInterval(() => {
      setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    }, 2000);
    return () => clearInterval(interval);
  }, [user_id, nano_id]);

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
    <div className="mx-auto w-full max-w-3xl">
      <ReceiveCard
        qrCodeData={qrCodeData}
        qrTcoinAmount={qrTcoinAmount}
        qrCadAmount={qrCadAmount}
        handleQrTcoinChange={handleQrTcoinChange}
        handleQrCadChange={handleQrCadChange}
        senderWallet=""
        handleQrTcoinBlur={handleQrTcoinBlur}
        handleQrCadBlur={handleQrCadBlur}
        tokenLabel="TCOIN"
        qrBgColor="#fff"
        qrFgColor="#000"
        qrWrapperClassName="bg-white p-1"
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
