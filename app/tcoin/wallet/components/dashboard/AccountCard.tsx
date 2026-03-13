import React from "react";
import { FiCopy } from "react-icons/fi";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";

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
  const { exchangeRate } = useControlVariables();

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

  const shortenedAddress = (address: string) => {
    if (address?.length <= 10) return address;
    return `${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`;
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(senderWallet)
      .then(() => alert("Wallet address copied to clipboard!"))
      .catch((error) => console.error("Copy failed:", error));
  };

  const explorerBaseUrl =
    process.env.NEXT_PUBLIC_EXPLORER_URL ||
    "https://explorer.example.com/address/";
  const explorerHref = `${explorerBaseUrl}${senderWallet}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Account</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold">Your Balance</h2>
          <div className="mb-1 flex items-center justify-center space-x-2">
            <span className="text-md break-all font-bold" title={senderWallet}>
              {`Wallet: ${shortenedAddress(senderWallet)}`}
            </span>
            <button onClick={handleCopy} title="Copy wallet address">
              <FiCopy className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block text-xs text-blue-500 underline"
          >
            View on Explorer
          </a>
          <p className="text-4xl font-bold">
            {formatNumber(rest.balance.toString(), false)}
          </p>
          <p className="text-xl">
            {formatNumber(convertToCad(rest.balance), true)} CAD
          </p>
          {typeof totalEquivalent === "number" && Number.isFinite(totalEquivalent) && (
            <p className="mt-3 text-sm text-muted-foreground">
              Total (TCOIN equiv): {formatNumber(totalEquivalent.toString(), false)}
            </p>
          )}
          {typeof voucherEquivalent === "number" &&
            Number.isFinite(voucherEquivalent) &&
            voucherEquivalent > 0 && (
              <p className="text-xs text-muted-foreground">
                Includes {voucherCount ?? 0} voucher token{(voucherCount ?? 0) === 1 ? "" : "s"} totalling{" "}
                {formatNumber(voucherEquivalent.toString(), false)}
              </p>
            )}
          <Button
            type="button"
            className="mt-4 w-full"
            variant="outline"
            onClick={onOpenTransactionHistory}
          >
            View transaction history
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
