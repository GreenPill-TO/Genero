import React from "react";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { walletActionButtonClass, walletBadgeClass, walletPanelClass, walletPanelMutedClass } from "./authenticated-ui";
import { BuyTcoinModal, TopUpModal } from "@tcoin/wallet/components/modals";

export function SimpleWalletHome({ tokenLabel = "TCOIN" }: { tokenLabel?: string }) {
  const { userData } = useAuth();
  const { openModal, closeModal } = useModal();
  const userId = userData?.cubidData?.id;
  const { senderWallet } = useSendMoney({
    senderId: userId ?? 0,
    receiverId: null,
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

  const openBuyTcoinModal = () => {
    openModal({
      content: <BuyTcoinModal closeModal={closeModal} />,
      title: "Buy TCOIN",
      description: "Checkout with fiat to acquire cplTCOIN from USDC on Celo through the TorontoCoin liquidity router.",
    });
  };

  const openTopUpModal = () => {
    openModal({
      content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
      title: "Top Up with Interac eTransfer",
      description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} balance.`,
    });
  };

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
          <button type="button" className={walletActionButtonClass} onClick={openTopUpModal}>
            Top Up with Interac
          </button>
          <button type="button" className={walletActionButtonClass} onClick={openBuyTcoinModal}>
            Buy more TCOIN
          </button>
        </div>
      </section>
    </div>
  );
}
