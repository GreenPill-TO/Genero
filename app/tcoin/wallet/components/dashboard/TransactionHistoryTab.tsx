import React, { useEffect, useMemo, useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { getWalletTransactionHistory } from "@shared/lib/edge/walletOperationsClient";

type TransactionRow = {
  id: number;
  amount: number;
  currency: string;
  walletFrom: string | null;
  walletTo: string | null;
  createdAt: string | null;
  direction: "sent" | "received" | "internal";
};

type DisplayRow = {
  id: number;
  direction: "sent" | "received" | "internal";
  amount: number;
  counterparty: string;
  createdAt: string;
  createdAtTs: number;
};

const formatAmount = (amount: number, currency: string) =>
  `${amount.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const formatWallet = (wallet: string | null) => {
  if (!wallet) return "Unknown";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

export function TransactionHistoryTab({
  onBackToDashboard,
}: {
  onBackToDashboard: () => void;
}) {
  const { userData } = useAuth();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userId = useMemo(() => {
    const raw = userData?.cubidData?.id;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userData?.cubidData?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (!userId) {
        if (isMounted) {
          setRows([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getWalletTransactionHistory({ appContext: { citySlug: "tcoin" } });
        const sourceRows = Array.isArray(response.entries) ? response.entries : [];

        if (sourceRows.length === 0) {
          if (isMounted) {
            setRows([]);
            setIsLoading(false);
          }
          return;
        }

        const deduped = new Map<number, TransactionRow>();

        sourceRows.forEach((row: any) => {
          const id = Number(row.id);
          if (!Number.isFinite(id)) return;

          const amount =
            typeof row.amount === "number"
              ? row.amount
              : Number.parseFloat(String(row.amount ?? "0"));
          const currency =
            typeof row.currency === "string" && row.currency.trim() !== ""
              ? row.currency
              : "TCOIN";
          const walletFrom = typeof row.wallet_account_from === "string" ? row.wallet_account_from : null;
          const walletTo = typeof row.wallet_account_to === "string" ? row.wallet_account_to : null;
          const createdAt =
            typeof row.created_at === "string" ? row.created_at : null;
          const direction =
            row.direction === "received" || row.direction === "internal" ? row.direction : "sent";

          if (!Number.isFinite(amount)) return;

          const previous = deduped.get(id);
          if (!previous || (createdAt ?? "") > (previous.createdAt ?? "")) {
            deduped.set(id, { id, amount, currency, walletFrom, walletTo, createdAt, direction });
          }
        });

        const nextRows: DisplayRow[] = Array.from(deduped.values())
          .map((row) => {
            const direction: DisplayRow["direction"] = row.direction;

            const counterpartyWallet =
              direction === "sent"
                ? row.walletTo
                : direction === "received"
                  ? row.walletFrom
                  : row.walletTo ?? row.walletFrom;

            const createdAtLabel = row.createdAt
              ? new Date(row.createdAt).toLocaleString("en-CA")
              : "Unknown date";
            const createdAtTs = row.createdAt ? Date.parse(row.createdAt) : 0;

            return {
              id: row.id,
              direction,
              amount: row.amount,
              counterparty: formatWallet(counterpartyWallet),
              createdAt: createdAtLabel,
              createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : 0,
            };
          })
          .sort((a, b) => b.createdAtTs - a.createdAtTs);

        if (isMounted) {
          setRows(nextRows);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setIsLoading(false);
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load transaction history."
          );
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <div className="space-y-4 lg:px-[25vw]">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transaction History</h2>
          <p className="text-sm text-muted-foreground">
            Your recent TCOIN transfers in and out of your wallet.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={onBackToDashboard}
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <LuArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading transaction history...</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-500">{errorMessage}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions found yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const directionLabel =
                row.direction === "sent"
                  ? "Sent"
                  : row.direction === "received"
                    ? "Received"
                    : "Internal";
              const amountPrefix = row.direction === "sent" ? "-" : "+";
              const amountColor =
                row.direction === "sent"
                  ? "text-red-500"
                  : row.direction === "received"
                    ? "text-green-500"
                    : "text-muted-foreground";

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{directionLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Counterparty: {row.counterparty}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.createdAt}</p>
                  </div>
                  <p className={`text-sm font-semibold ${amountColor}`}>
                    {amountPrefix}
                    {formatAmount(row.amount, "TCOIN")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
