import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";
import { ContributionsCard } from "./ContributionsCard";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { OtherCard } from "./OtherCard";
import { Hypodata } from "./types";

export function WalletHome({ tokenLabel = "Tcoin" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();

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

  const sanitizeNumeric = useCallback((value: string) => value.replace(/[^\d.]/g, ""), []);
  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;

  const convertTcoinToCad = useCallback((value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || safeExchangeRate === 0) return "";
    return (num * safeExchangeRate).toString();
  }, [safeExchangeRate]);

  const convertCadToTcoin = useCallback((value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || safeExchangeRate === 0) return "";
    return (num / safeExchangeRate).toString();
  }, [safeExchangeRate]);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setTcoinAmount(rawValue);
    if (rawValue === "") {
      setCadAmount("");
      return;
    }
    const cadRaw = convertTcoinToCad(rawValue);
    setCadAmount(cadRaw);
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setCadAmount(rawValue);
    if (rawValue === "") {
      setTcoinAmount("");
      return;
    }
    const tcoinRaw = convertCadToTcoin(rawValue);
    setTcoinAmount(tcoinRaw);
  };

  const handleTcoinBlur = () => {
    if (tcoinAmount.trim() === "") {
      setCadAmount("");
      return;
    }
    const numericValue = parseFloat(tcoinAmount);
    if (isNaN(numericValue)) {
      setTcoinAmount("");
      setCadAmount("");
      return;
    }
    const normalizedTcoin = numericValue.toFixed(2);
    const cadNumeric = safeExchangeRate === 0 ? 0 : numericValue * safeExchangeRate;
    setTcoinAmount(normalizedTcoin);
    setCadAmount(cadNumeric.toFixed(2));
  };

  const handleCadBlur = () => {
    if (cadAmount.trim() === "") {
      setTcoinAmount("");
      return;
    }
    const numericValue = parseFloat(cadAmount);
    if (isNaN(numericValue)) {
      setCadAmount("");
      setTcoinAmount("");
      return;
    }
    const normalizedCad = numericValue.toFixed(2);
    const tcoinNumeric = safeExchangeRate === 0 ? 0 : numericValue / safeExchangeRate;
    setCadAmount(normalizedCad);
    setTcoinAmount(tcoinNumeric.toFixed(2));
  };

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
      if (!rest?.nano_id) return;
      try {
        const supabase = createClient();
        const { data: userDataFromSupabaseTable, error } = await supabase
          .from("users")
          .select("*")
          .match({ user_identifier: rest.nano_id });
        if (error) throw error;

        const { error: insertError } = await supabase.from("connections").insert({
          owner_user_id: userData?.cubidData?.id,
          connected_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        if (insertError) throw insertError;

        setToSendData(userDataFromSupabaseTable?.[0]);
        if (rest?.qrTcoinAmount) {
          const sanitized = sanitizeNumeric(String(rest.qrTcoinAmount));
          if (sanitized) {
            const numeric = Number.parseFloat(sanitized);
            if (Number.isFinite(numeric)) {
              setTcoinAmount(numeric.toFixed(2));
              const cadNumeric = safeExchangeRate === 0 ? 0 : numeric * safeExchangeRate;
              setCadAmount(cadNumeric.toFixed(2));
            }
          }
        }
        toast.success("Scanned User Successfully");
      } catch (err) {
        console.error("handleScan error", err);
      }
    },
    [safeExchangeRate, sanitizeNumeric, userData]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("pay")) {
      handleScan(url.toString());
    }
  }, [handleScan]);
  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const { senderWallet, sendMoney } = useSendMoney({
    senderId: user_id,
    receiverId: toSendData?.id ?? null,
  });

  const { balance: rawBalance } = useTokenBalance(senderWallet);
  const userBalance = parseFloat(rawBalance) || 0;

  const handleUseMax = () => {
    const cadNumeric = safeExchangeRate === 0 ? 0 : userBalance * safeExchangeRate;
    setTcoinAmount(userBalance.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

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
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          handleTcoinBlur={handleTcoinBlur}
          handleCadBlur={handleCadBlur}
          sendMoney={sendMoney}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
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
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          handleTcoinBlur={handleTcoinBlur}
          handleCadBlur={handleCadBlur}
          sendMoney={sendMoney}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
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
