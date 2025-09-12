import React, { useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useModal } from "@shared/contexts/ModalContext";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import { Hypodata } from "./types";
import { SendCard } from "./SendCard";

interface SendTabProps {
  recipient: Hypodata | null;
}

export function SendTab({ recipient }: SendTabProps) {
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();
  const { sendMoney } = useSendMoney();
  const { balance } = useTokenBalance(userData?.cubidData?.wallet_address || "");
  const { openModal, closeModal } = useModal();

  const [toSendData, setToSendData] = useState<Hypodata | null>(recipient);
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  useEffect(() => {
    setToSendData(recipient);
  }, [recipient]);

  useEffect(() => {
    openModal({
      content: (
        <QrScanModal
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
          setToSendData={setToSendData}
          closeModal={closeModal}
        />
      ),
      title: "Scan QR to Pay",
      description: "Use your device's camera to scan a QR code for payment.",
    });
  }, [openModal, closeModal]);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setTcoinAmount(raw);
    const num = parseFloat(raw) || 0;
    setCadAmount((num * exchangeRate).toString());
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setCadAmount(raw);
    const num = parseFloat(raw) || 0;
    setTcoinAmount((num / exchangeRate).toString());
  };

  return (
    <div className="space-y-4">
      <SendCard
        toSendData={toSendData}
        setToSendData={setToSendData}
        tcoinAmount={tcoinAmount}
        cadAmount={cadAmount}
        handleTcoinChange={handleTcoinChange}
        handleCadChange={handleCadChange}
        explorerLink={explorerLink}
        setExplorerLink={setExplorerLink}
        setTcoin={setTcoinAmount}
        setCad={setCadAmount}
        sendMoney={sendMoney}
        userBalance={balance}
      />
    </div>
  );
}
