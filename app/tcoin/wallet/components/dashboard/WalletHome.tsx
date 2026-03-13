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
import { BuyTcoinModal, TopUpModal } from "@tcoin/wallet/components/modals";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { Hypodata } from "./types";

type WalletHomeProps = {
  tokenLabel?: string;
  onOpenRequest?: () => void;
};

export function WalletHome({ tokenLabel = "TCOIN", onOpenRequest }: WalletHomeProps) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();

  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [activeIntent, setActiveIntent] = useState<"overview" | "pay">("overview");

  const buyCheckoutEnabled =
    (process.env.NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1 ?? "false").trim().toLowerCase() === "true";

  const { exchangeRate } = useControlVariables();
  const userId = userData?.cubidData.id;

  const sanitizeNumeric = useCallback((value: string) => value.replace(/[^\d.]/g, ""), []);
  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;

  const convertTcoinToCad = useCallback((value: string) => {
    const num = Number.parseFloat(value);
    if (Number.isNaN(num) || safeExchangeRate === 0) return "";
    return (num * safeExchangeRate).toString();
  }, [safeExchangeRate]);

  const convertCadToTcoin = useCallback((value: string) => {
    const num = Number.parseFloat(value);
    if (Number.isNaN(num) || safeExchangeRate === 0) return "";
    return (num / safeExchangeRate).toString();
  }, [safeExchangeRate]);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setTcoinAmount(rawValue);
    if (rawValue === "") {
      setCadAmount("");
      return;
    }
    setCadAmount(convertTcoinToCad(rawValue));
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setCadAmount(rawValue);
    if (rawValue === "") {
      setTcoinAmount("");
      return;
    }
    setTcoinAmount(convertCadToTcoin(rawValue));
  };

  const handleTcoinBlur = () => {
    if (tcoinAmount.trim() === "") {
      setCadAmount("");
      return;
    }
    const numericValue = Number.parseFloat(tcoinAmount);
    if (Number.isNaN(numericValue)) {
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
    const numericValue = Number.parseFloat(cadAmount);
    if (Number.isNaN(numericValue)) {
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

  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const handleScan = useCallback(
    async (data: string) => {
      const payload = extractAndDecodeBase64(data);
      if (!payload?.nano_id) return;
      try {
        const supabase = createClient();
        const { data: userDataFromSupabaseTable, error } = await supabase
          .from("users")
          .select("*")
          .match({ user_identifier: payload.nano_id });
        if (error) throw error;

        const { error: insertError } = await supabase.from("connections").insert({
          owner_user_id: userData?.cubidData?.id,
          connected_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        if (insertError) throw insertError;

        setToSendData(userDataFromSupabaseTable?.[0] ?? null);
        if (payload?.qrTcoinAmount) {
          const sanitized = sanitizeNumeric(String(payload.qrTcoinAmount));
          if (sanitized) {
            const numeric = Number.parseFloat(sanitized);
            if (Number.isFinite(numeric)) {
              setTcoinAmount(numeric.toFixed(2));
              const cadNumeric = safeExchangeRate === 0 ? 0 : numeric * safeExchangeRate;
              setCadAmount(cadNumeric.toFixed(2));
            }
          }
        }

        setActiveIntent("pay");
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
      void handleScan(url.toString());
    }
  }, [handleScan]);

  const { senderWallet, sendMoney } = useSendMoney({
    senderId: userId ?? 0,
    receiverId: toSendData?.id ?? null,
  });

  const { balance: rawBalance } = useTokenBalance(senderWallet);
  const userBalance = Number.parseFloat(rawBalance) || 0;
  const { portfolio } = useVoucherPortfolio({ enabled: Boolean(senderWallet) });

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

  const openTopUpModal = () => {
    openModal({
      content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
      title: "Top Up with Interac eTransfer",
      description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} balance.`,
    });
  };

  const handleRequestIntent = () => {
    if (onOpenRequest) {
      onOpenRequest();
      return;
    }
    toast.info("Open the Receive tab to create a request.");
  };

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="mx-auto max-w-[520px] space-y-6">
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet ?? ""}
        />

        <div className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Pay To</h3>
          <p className="text-xs text-muted-foreground">
            Start a payment, top up, or request separately to keep each flow clear.
          </p>
          <Button className="w-full" onClick={() => setActiveIntent("pay")}>
            Pay To
          </Button>
          <Button className="w-full" variant="outline" onClick={handleRequestIntent}>
            Request
          </Button>
        </div>

        {activeIntent === "pay" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Send Payment</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveIntent("overview");
                  setToSendData(null);
                  setTcoinAmount("");
                  setCadAmount("");
                  setExplorerLink(null);
                }}
              >
                Back to Balance
              </Button>
            </div>
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
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/70 p-4 space-y-2">
          <h3 className="text-sm font-semibold">Top Up / Buy</h3>
          <p className="text-xs text-muted-foreground">
            Add funds using Buy TCOIN checkout or Interac top-up.
          </p>
          {buyCheckoutEnabled && (
            <Button className="w-full" onClick={openBuyTcoinModal}>
              Buy TCOIN
            </Button>
          )}
          <Button className="w-full" variant="outline" onClick={openTopUpModal}>
            Top Up with Interac eTransfer
          </Button>
        </div>
      </div>
    </div>
  );
}
