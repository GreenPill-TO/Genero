import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useVoucherPortfolio } from "@shared/hooks/useVoucherPortfolio";
import { createClient } from "@shared/lib/supabase/client";
import { Button } from "@shared/components/ui/Button";
import { BuyTcoinModal } from "@tcoin/wallet/components/modals";
import { ContributionsCard } from "./ContributionsCard";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { OtherCard } from "./OtherCard";
import { Hypodata } from "./types";

export function WalletHome({ tokenLabel = "Tcoin" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const activeProfile = userData?.cubidData?.activeProfile;

  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [selectedCharity, setSelectedCharity] = useState("");
  const buyCheckoutEnabled =
    (process.env.NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1 ?? "false").trim().toLowerCase() === "true";

  useEffect(() => {
    const defaultCharity = activeProfile?.charityPreferences?.charity;
    if (defaultCharity) {
      setSelectedCharity(defaultCharity);
    }
  }, [activeProfile]);

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
    senderId: user_id ?? 0,
    receiverId: toSendData?.id ?? null,
  });

  const { balance: rawBalance } = useTokenBalance(senderWallet);
  const userBalance = parseFloat(rawBalance) || 0;
  const { portfolio } = useVoucherPortfolio({ enabled: Boolean(senderWallet) });
  const [myPoolMerchants, setMyPoolMerchants] = useState<
    Array<{ merchantStoreId: number; displayName?: string; tokenSymbol?: string }>
  >([]);

  useEffect(() => {
    if (!senderWallet) return;

    const loadMerchants = async () => {
      try {
        const response = await fetch("/api/vouchers/merchants?citySlug=tcoin&scope=my_pool", {
          credentials: "include",
        });
        const body = await response.json();
        if (!response.ok) {
          return;
        }
        const rows = Array.isArray(body?.merchants) ? body.merchants : [];
        const normalized = rows
          .filter((row: any) => row && typeof row === "object" && row.available === true)
          .map((row: any) => ({
            merchantStoreId: Number(row.merchantStoreId),
            displayName: typeof row.displayName === "string" ? row.displayName : undefined,
            tokenSymbol: typeof row.tokenSymbol === "string" ? row.tokenSymbol : undefined,
          }))
          .filter((row: any) => Number.isFinite(row.merchantStoreId))
          .slice(0, 6);
        setMyPoolMerchants(normalized);
      } catch {
        setMyPoolMerchants([]);
      }
    };

    void loadMerchants();
  }, [senderWallet]);

  const handleUseMax = () => {
    const cadNumeric = safeExchangeRate === 0 ? 0 : userBalance * safeExchangeRate;
    setTcoinAmount(userBalance.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const openBuyTcoinModal = () => {
    openModal({
      content: <BuyTcoinModal closeModal={closeModal} />,
      title: "Buy TCOIN",
      description: "Checkout with fiat to mint TCOIN automatically from USDC on Celo.",
    });
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
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
        />
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet ?? ""}
        />
        {buyCheckoutEnabled && (
          <div className="rounded-xl border border-border bg-card/70 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Buy TCOIN</h3>
            <p className="text-xs text-muted-foreground">
              One checkout flow: fiat to USDC on Celo to TCOIN.
            </p>
            <Button className="w-full" onClick={openBuyTcoinModal}>
              Buy TCOIN
            </Button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold">Merchants in My Pool</h3>
          {myPoolMerchants.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No mapped merchants were found in your primary/secondary BIA pools.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {myPoolMerchants.map((merchant) => (
                <li key={`${merchant.merchantStoreId}:${merchant.tokenSymbol ?? "token"}`}>
                  {merchant.displayName ?? `Store ${merchant.merchantStoreId}`}
                  {merchant.tokenSymbol ? ` - ${merchant.tokenSymbol}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
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
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
        />
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet ?? ""}
        />
        {buyCheckoutEnabled && (
          <div className="rounded-xl border border-border bg-card/70 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Buy TCOIN</h3>
            <p className="text-xs text-muted-foreground">
              One checkout flow: fiat to USDC on Celo to TCOIN.
            </p>
            <Button className="w-full" onClick={openBuyTcoinModal}>
              Buy TCOIN
            </Button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold">Merchants in My Pool</h3>
          {myPoolMerchants.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No mapped merchants were found in your primary/secondary BIA pools.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {myPoolMerchants.map((merchant) => (
                <li key={`${merchant.merchantStoreId}:${merchant.tokenSymbol ?? "token"}`}>
                  {merchant.displayName ?? `Store ${merchant.merchantStoreId}`}
                  {merchant.tokenSymbol ? ` - ${merchant.tokenSymbol}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <OtherCard
          openModal={openModal}
          closeModal={closeModal}
          tokenLabel={tokenLabel}
        />
      </div>
    </div>
  );
}
