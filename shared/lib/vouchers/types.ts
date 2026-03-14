export type VoucherTrustStatus = "trusted" | "blocked" | "default";

export type VoucherToken = {
  chainId: number;
  tokenAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  merchantWallet?: `0x${string}`;
  merchantStoreId?: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
};

export type VoucherBalance = {
  chainId: number;
  walletAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  balance: string;
  updatedAt?: string;
};

export type VoucherPortfolio = {
  citySlug: string;
  chainId: number;
  walletAddress: `0x${string}`;
  tcoinBalance: string;
  voucherBalances: VoucherBalance[];
  voucherEquivalent: string;
  totalEquivalent: string;
  breakdown: Array<{
    kind: "tcoin" | "voucher";
    tokenAddress?: `0x${string}`;
    symbol: string;
    amount: string;
    equivalent: string;
  }>;
  updatedAt?: string;
};

export type VoucherRouteMode = "voucher" | "tcoin_fallback";

export type VoucherRouteQuote = {
  mode: VoucherRouteMode;
  reason: string;
  citySlug: string;
  chainId: number;
  recipientWallet: `0x${string}`;
  merchantStoreId?: number;
  poolAddress?: `0x${string}`;
  tokenAddress?: `0x${string}`;
  tokenSymbol?: string;
  tokenDecimals?: number;
  amountInTcoin: string;
  expectedVoucherOut?: string;
  minVoucherOut?: string;
  quoteSource?: "pool_getQuote" | "quoter_valueFor" | "fallback";
  feePpm?: number;
  slippageBps?: number;
  guardDecisions: string[];
};

export type VoucherPreference = {
  id?: string;
  userId: number;
  appInstanceId: number;
  citySlug: string;
  merchantStoreId?: number;
  tokenAddress?: `0x${string}`;
  trustStatus: VoucherTrustStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type MerchantVoucherLiquidity = {
  merchantStoreId: number;
  displayName?: string;
  walletAddress?: `0x${string}`;
  biaId?: string;
  biaCode?: string;
  biaName?: string;
  chainId: number;
  poolAddress?: `0x${string}`;
  tokenAddress?: `0x${string}`;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  voucherIssueLimit?: string | null;
  requiredLiquidityAbsolute?: string | null;
  requiredLiquidityRatio?: string | null;
  creditIssued?: string;
  creditRemaining?: string | null;
  sourceMode?: "contract_field" | "derived_supply";
  available: boolean;
};

export type VoucherSummary = {
  trackedVoucherTokens: number;
  walletsWithVoucherBalances: number;
  merchantCreditRows: number;
  lastVoucherBlock: number | null;
};
