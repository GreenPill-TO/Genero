import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import { ContributionsCard } from "./ContributionsCard";
import { ReceiveCard } from "./ReceiveCard";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { OtherCard } from "./OtherCard";
import { Hypodata } from "./types";

export function WalletHome({
  qrBgColor,
  qrFgColor,
  qrWrapperClassName,
  tokenLabel = "Tcoin",
}: {
  qrBgColor?: string;
  qrFgColor?: string;
  qrWrapperClassName?: string;
  tokenLabel?: string;
}) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();

  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [selectedCharity, setSelectedCharity] = useState("");

  useEffect(() => {
    if (userData?.cubidData?.charity) {
      setSelectedCharity(userData.cubidData.charity);
    }
  }, [userData]);

  const { exchangeRate } = useControlVariables();
  const [charityData] = useState({
    personalContribution: 50,
    allUsersToCharity: 600,
    allUsersToAllCharities: 7000,
  });

  const user_id = userData?.cubidData.id;
  const nano_id = userData?.cubidData.user_identifier;
  const [qrCodeData, setQrCodeData] = useState(
    user_id ? JSON.stringify({ nano_id, timestamp: Date.now() }) : ""
  );

  useEffect(() => {
    if (!user_id) return;
    setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    const interval = setInterval(() => {
      setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    }, 2000);
    return () => clearInterval(interval);
  }, [user_id, tcoinAmount, nano_id]);

  function extractDecimalFromString(value: string) {
    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  function extractAndDecodeBase64(url: string) {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData);
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  }

  const handleScan = useCallback(
    async (data: any) => {
      const rest = extractAndDecodeBase64(data);
      const supabase = createClient();
      toast.success("Scanned User Successfully");
      if (rest?.nano_id) {
        const { data: userDataFromSupabaseTable } = await supabase
          .from("users")
          .select("*")
          .match({ user_identifier: rest.nano_id });
        await supabase.from("connections").insert({
          owner_user_id: userData?.cubidData?.id,
          connected_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        setToSendData(userDataFromSupabaseTable?.[0]);
        if (rest?.qrTcoinAmount) {
          setTcoinAmount(rest.qrTcoinAmount);
          setCadAmount(
            extractDecimalFromString(rest.qrTcoinAmount) * exchangeRate + ""
          );
        }
      }
    },
    [exchangeRate, userData]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      handleScan(window.location.href);
    }
  }, [handleScan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => {
      if (window.localStorage.getItem("openQR")) {
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
        window.localStorage.removeItem("openQR");
      }
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [openModal, closeModal]);

  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  const debounceDelay = 1000;
  const tcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrTcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (tcoinTimeoutRef.current) clearTimeout(tcoinTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setTcoinAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const cadRaw = (num * exchangeRate).toString();
    tcoinTimeoutRef.current = setTimeout(() => {
      setTcoinAmount(formatNumber(rawValue, false));
      setCadAmount(formatNumber(cadRaw, true));
    }, debounceDelay);
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cadTimeoutRef.current) clearTimeout(cadTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setCadAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const tcoinRaw = (num / exchangeRate).toString();
    cadTimeoutRef.current = setTimeout(() => {
      setCadAmount(formatNumber(rawValue, true));
      setTcoinAmount(formatNumber(tcoinRaw, false));
    }, debounceDelay);
  };

  const handleQrTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setQrTcoinAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    setQrCadAmount((num * exchangeRate).toString());
  };

  const handleQrCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setQrCadAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    setQrTcoinAmount((num / exchangeRate).toString());
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

  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const { senderWallet, sendMoney } = useSendMoney({
    senderId: user_id,
    receiverId: toSendData?.id ?? null,
  });

  const { balance: userBalance } = useTokenBalance(senderWallet);

  const dynamicQrData = qrTcoinAmount
    ? JSON.stringify({ ...JSON.parse(qrCodeData), qrTcoinAmount })
    : qrCodeData;

  function base64Encode(str: string) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  const qrData = `https://tcoin.me?pay=${base64Encode(dynamicQrData)}`;

  return (
    <div className="container mx-auto p-4 space-y-8 pb-24">
      <div className="space-y-8 max-w-[400px] mx-auto md:hidden">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <ReceiveCard
          qrCodeData={qrData}
          qrTcoinAmount={qrTcoinAmount}
          qrCadAmount={qrCadAmount}
          handleQrTcoinChange={handleQrTcoinChange}
          handleQrCadChange={handleQrCadChange}
          handleQrCadBlur={handleQrCadBlur}
          handleQrTcoinBlur={handleQrTcoinBlur}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet}
          qrBgColor={qrBgColor}
          qrFgColor={qrFgColor}
          qrWrapperClassName={qrWrapperClassName}
          tokenLabel={tokenLabel}
        />
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          sendMoney={sendMoney}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
        />
        <AccountCard
          balance={userBalance}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet}
        />
        <OtherCard
          openModal={openModal}
          closeModal={closeModal}
          tokenLabel={tokenLabel}
        />
      </div>
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <ReceiveCard
          qrCodeData={qrData}
          qrTcoinAmount={qrTcoinAmount}
          qrCadAmount={qrCadAmount}
          handleQrTcoinChange={handleQrTcoinChange}
          handleQrCadChange={handleQrCadChange}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet}
          qrBgColor={qrBgColor}
          qrFgColor={qrFgColor}
          qrWrapperClassName={qrWrapperClassName}
          tokenLabel={tokenLabel}
        />
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          sendMoney={sendMoney}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
        />
        <AccountCard
          balance={userBalance}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet}
        />
        <OtherCard
          openModal={openModal}
          closeModal={closeModal}
          tokenLabel={tokenLabel}
        />
      </div>
    </div>
  );
}
