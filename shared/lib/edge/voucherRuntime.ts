import type { VoucherPortfolio, VoucherRouteQuote } from "@shared/lib/vouchers/types";

export type VoucherRuntimePortfolioResponse = {
  appInstanceId: number;
  scopeKey: string;
  portfolio: VoucherPortfolio | null;
};

export type VoucherRuntimeRouteResponse = {
  citySlug: string;
  chainId: number;
  appInstanceId: number;
  quote: VoucherRouteQuote;
};

export type VoucherRuntimePaymentRecordResponse = {
  record: Record<string, unknown>;
};
