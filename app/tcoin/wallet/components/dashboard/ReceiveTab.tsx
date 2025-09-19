import React, { useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { ReceiveCard } from "./ReceiveCard";
import { Hypodata } from "./types";

export function ReceiveTab({ contact }: { contact?: Hypodata | null }) {
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

  return (
    <div className="lg:px-[25vw]">
      <ReceiveCard
        qrCodeData={qrCodeData}
        qrTcoinAmount={qrTcoinAmount}
        qrCadAmount={qrCadAmount}
        handleQrTcoinChange={handleQrTcoinChange}
        handleQrCadChange={handleQrCadChange}
        senderWallet={userData?.cubidData?.wallet_address || ""}
        handleQrTcoinBlur={handleQrTcoinBlur}
        handleQrCadBlur={handleQrCadBlur}
        tokenLabel="TCOIN"
        qrBgColor="#fff"
        qrFgColor="#000"
        qrWrapperClassName="bg-white p-1"
        requestContact={requestContact}
        onClearRequestContact={() => setRequestContact(null)}
      />
    </div>
  );
}
