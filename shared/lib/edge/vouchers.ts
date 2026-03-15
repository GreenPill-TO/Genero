import type { OperationalState } from "./types";

export type VoucherPreferencesResponse = {
  citySlug: string;
  appInstanceId: number;
  preferences: Array<Record<string, unknown>>;
};

export type VoucherCompatibilityRule = {
  id: string;
  city_slug: string;
  chain_id: number;
  pool_address: string;
  token_address: string;
  merchant_store_id: number | null;
  accepted_by_default: boolean;
  rule_status: string;
  updated_at: string | null;
};

export type VoucherCompatibilityResponse = {
  citySlug: string;
  chainId: number;
  rules: VoucherCompatibilityRule[];
};

export type SaveVoucherCompatibilityInput = {
  chainId?: number;
  poolAddress: string;
  tokenAddress: string;
  merchantStoreId?: number | null;
  acceptedByDefault?: boolean;
  ruleStatus?: "active" | "inactive";
  reason?: string;
};

export type VoucherMerchantLiquidity = {
  merchantStoreId: number;
  displayName?: string;
  walletAddress?: string;
  biaId?: string;
  biaCode?: string;
  biaName?: string;
  chainId?: number;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  voucherIssueLimit?: string | null;
  requiredLiquidityAbsolute?: string | null;
  requiredLiquidityRatio?: string | null;
  creditIssued?: string;
  creditRemaining?: string | null;
  sourceMode?: string;
  available: boolean;
};

export type VoucherMerchantsResponse = {
  citySlug: string;
  chainId: number;
  state: OperationalState;
  setupMessage?: string | null;
  scope: "city" | "my_pool";
  liquiditySource: string;
  readOnly: boolean;
  appInstanceId: number;
  biaScope: {
    primaryBiaId: string | null;
    secondaryBiaIds: string[];
  };
  merchants: VoucherMerchantLiquidity[];
};
