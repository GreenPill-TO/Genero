import React, { useEffect, useRef, useState } from "react";
import { useCurrentWalletAddress } from "@shared/hooks/useCurrentWalletAddress";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { walletActionButtonClass, walletBadgeClass, walletPanelClass, walletPanelMutedClass } from "./authenticated-ui";
import { LuChevronDown } from "react-icons/lu";

export function SimpleWalletHome({ tokenLabel = "TCOIN" }: { tokenLabel?: string }) {
  const { userData } = useAuth();
  const { openModal, closeModal } = useModal();
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState(false);
  const buyMenuRef = useRef<HTMLDivElement | null>(null);
  const userId = userData?.cubidData?.id;
  const { walletAddress: senderWallet } = useCurrentWalletAddress({
    enabled: Boolean(userId),
  });
  const { balance } = useTokenBalance(senderWallet);
  const { exchangeRate, fallbackMessage } = useControlVariables();
  const parsedBalance = Number.parseFloat(balance || "0") || 0;

  const formatNumber = (value: number, isCad = false) => {
    const formatted = value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  const openBuyTcoinModal = async () => {
    setIsBuyMenuOpen(false);
    const { BuyTcoinModal } = await import("@tcoin/wallet/components/modals/BuyTcoinModal");
    openModal({
      content: <BuyTcoinModal closeModal={closeModal} />,
      title: "Buy TCOIN",
      description: "Checkout with fiat to acquire cplTCOIN from USDC on Celo through the TorontoCoin liquidity router.",
    });
  };

  const openTopUpModal = async () => {
    setIsBuyMenuOpen(false);
    const { TopUpModal } = await import("@tcoin/wallet/components/modals/TopUpModal");
    openModal({
      content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
      title: "Top Up with Interac eTransfer",
      description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} balance.`,
    });
  };

  useEffect(() => {
    if (!isBuyMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!buyMenuRef.current?.contains(event.target as Node)) {
        setIsBuyMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBuyMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isBuyMenuOpen]);

  return (
    <div className="space-y-4" data-testid="simple-wallet-home">
      <section className={`${walletPanelClass} space-y-5`}>
        <div className="space-y-3">
          <span className={walletBadgeClass}>Account overview</span>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">Available balance</h2>
            <p className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
              {formatNumber(parsedBalance)}
            </p>
            <p className="text-lg text-muted-foreground">
              {formatNumber(parsedBalance * exchangeRate, true)} CAD
            </p>
          </div>
        </div>

        <div className={`${walletPanelMutedClass} space-y-3`}>
          <p className="text-sm text-muted-foreground">
            Keep this screen focused on your spendable balance, then top up or buy more when you need to.
          </p>
          {fallbackMessage ? <p className="text-sm text-amber-700 dark:text-amber-300">{fallbackMessage}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative" ref={buyMenuRef}>
            <button
              type="button"
              className={`${walletActionButtonClass} inline-flex items-center gap-2`}
              onClick={() => setIsBuyMenuOpen((current) => !current)}
              aria-expanded={isBuyMenuOpen}
              aria-haspopup="menu"
            >
              Buy more TCOIN
              <LuChevronDown className={`h-4 w-4 transition-transform ${isBuyMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isBuyMenuOpen ? (
              <div
                className="absolute left-0 top-full z-20 mt-2 min-w-[16rem] rounded-2xl border border-border/70 bg-background/95 p-2 shadow-2xl backdrop-blur"
                role="menu"
                aria-label="Buy more TCOIN options"
              >
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted"
                  role="menuitem"
                  onClick={openTopUpModal}
                >
                  Top up with Interac
                </button>
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted"
                  role="menuitem"
                  onClick={openBuyTcoinModal}
                >
                  Top up with Credit Card
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
