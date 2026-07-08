import type { VoucherBalance, VoucherPortfolio } from "./types";

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function formatAmount(value: number): string {
  return value.toFixed(6);
}

export function toTcoinEquivalent(amount: number): number {
  return toFiniteNumber(amount);
}

export function computeVoucherEquivalent(vouchers: VoucherBalance[]): number {
  return vouchers.reduce((sum, voucher) => sum + toTcoinEquivalent(toFiniteNumber(voucher.balance)), 0);
}

export function buildVoucherPortfolio(options: {
  citySlug: string;
  chainId: number;
  walletAddress: `0x${string}`;
  tcoinBalance: number | string;
  vouchers: VoucherBalance[];
  updatedAt?: string;
}): VoucherPortfolio {
  const tcoinBalanceNumber = toFiniteNumber(options.tcoinBalance);
  const voucherEquivalent = computeVoucherEquivalent(options.vouchers);
  const totalEquivalent = tcoinBalanceNumber + voucherEquivalent;

  return {
    citySlug: options.citySlug,
    chainId: options.chainId,
    walletAddress: options.walletAddress,
    tcoinBalance: formatAmount(tcoinBalanceNumber),
    voucherBalances: options.vouchers,
    voucherEquivalent: formatAmount(voucherEquivalent),
    totalEquivalent: formatAmount(totalEquivalent),
    breakdown: [
      {
        kind: "tcoin",
        symbol: "TCOIN",
        amount: formatAmount(tcoinBalanceNumber),
        equivalent: formatAmount(tcoinBalanceNumber),
      },
      ...options.vouchers.map((voucher) => ({
        kind: "voucher" as const,
        tokenAddress: voucher.tokenAddress,
        symbol: voucher.tokenSymbol ?? "VOUCHER",
        amount: formatAmount(toFiniteNumber(voucher.balance)),
        equivalent: formatAmount(toFiniteNumber(voucher.balance)),
      })),
    ],
    updatedAt: options.updatedAt,
  };
}
