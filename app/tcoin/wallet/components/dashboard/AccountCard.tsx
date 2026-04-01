import React from "react";
import { Button } from "@shared/components/ui/Button";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { walletPanelClass, walletPanelMutedClass } from "./authenticated-ui";

export function AccountCard({
  balance,
  totalEquivalent,
  voucherEquivalent,
  voucherCount,
  senderWallet,
  onOpenTransactionHistory,
}: {
  balance: number;
  totalEquivalent?: number;
  voucherEquivalent?: number;
  voucherCount?: number;
  senderWallet: string;
  onOpenTransactionHistory: () => void;
}) {
  const { ...rest } = useTokenBalance(senderWallet);
  const { exchangeRate, state: exchangeRateState } = useControlVariables();

  const convertToCad = (tcoin: number | string) => {
    const parsed = typeof tcoin === "number" ? tcoin : Number.parseFloat(tcoin);
    const safeTcoin = Number.isFinite(parsed) ? parsed : 0;
    return (safeTcoin * exchangeRate).toFixed(2);
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

  return (
    <section className={`${walletPanelClass} flex h-full flex-col gap-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Account overview
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">Available balance</h2>
            <p className="text-5xl font-semibold tracking-[-0.06em]">
              {formatNumber(rest.balance.toString(), false)}
            </p>
            <p className="text-lg text-muted-foreground">
              {formatNumber(convertToCad(rest.balance), true)} CAD
            </p>
          </div>
        </div>
        <div className={`${walletPanelMutedClass} min-w-[220px] space-y-3`}>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Today&apos;s estimate
            </p>
            <p className="text-2xl font-semibold">{formatNumber(convertToCad(rest.balance), true)}</p>
            <p className="text-sm text-muted-foreground">
              A live CAD estimate for the TCOIN that is ready to spend right now.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Wallet address, explorer access, and account settings now live in More.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={walletPanelMutedClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Spendable now</p>
          <p className="mt-2 text-xl font-semibold">{formatNumber(balance.toString(), false)}</p>
        </div>
        <div className={walletPanelMutedClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Wallet total</p>
          <p className="mt-2 text-xl font-semibold">
            {typeof totalEquivalent === "number" && Number.isFinite(totalEquivalent)
              ? formatNumber(totalEquivalent.toString(), false)
              : formatNumber(balance.toString(), false)}
          </p>
        </div>
        <div className={walletPanelMutedClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Voucher positions</p>
          <p className="mt-2 text-xl font-semibold">{voucherCount ?? 0}</p>
          {typeof voucherEquivalent === "number" && Number.isFinite(voucherEquivalent) && voucherEquivalent > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Equivalent to {formatNumber(voucherEquivalent.toString(), false)}
            </p>
          ) : null}
        </div>
      </div>

      {exchangeRateState !== "ready" ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          CAD conversion is using a fallback city-rate estimate.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="rounded-full px-5"
          onClick={onOpenTransactionHistory}
        >
          View transaction history
        </Button>
      </div>
    </section>
  );
}
