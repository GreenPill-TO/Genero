export type BiaStatus = "active" | "inactive";

export type BiaRecord = {
  id: string;
  citySlug: string;
  code: string;
  name: string;
  centerLat: number;
  centerLng: number;
  status: BiaStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BiaPoolMappingStatus = "active" | "inactive" | "pending";
export type BiaPoolValidationStatus = "unknown" | "valid" | "stale" | "mismatch";

export type BiaPoolMapping = {
  id: string;
  biaId: string;
  chainId: number;
  poolAddress: `0x${string}`;
  tokenRegistry?: `0x${string}`;
  tokenLimiter?: `0x${string}`;
  quoter?: `0x${string}`;
  feeAddress?: `0x${string}`;
  mappingStatus: BiaPoolMappingStatus;
  validationStatus: BiaPoolValidationStatus;
  validationNotes?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
};

export type UserBiaAffiliationSource = "user_selected" | "suggested" | "admin_assigned" | "migrated";

export type UserBiaAffiliation = {
  id: string;
  userId: number;
  appInstanceId: number;
  biaId: string;
  source: UserBiaAffiliationSource;
  confidence?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreProfileStatus = "active" | "inactive" | "suspended";

export type StoreProfile = {
  storeId: number;
  displayName?: string;
  walletAddress?: `0x${string}`;
  addressText?: string;
  lat?: number;
  lng?: number;
  status: StoreProfileStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoreBiaAffiliationSource = "merchant_selected" | "suggested" | "admin_assigned" | "migrated";

export type StoreBiaAffiliation = {
  id: string;
  storeId: number;
  biaId: string;
  source: StoreBiaAffiliationSource;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
};

export type PoolPurchaseStatus =
  | "pending"
  | "processing"
  | "submitted"
  | "confirmed"
  | "failed"
  | "cancelled";

export type PoolPurchaseRequest = {
  id: string;
  userId: number;
  appInstanceId?: number;
  biaId: string;
  chainId: number;
  poolAddress: `0x${string}`;
  tokenAddress?: `0x${string}`;
  fiatAmount: number;
  tokenAmount: number;
  txHash?: string;
  status: PoolPurchaseStatus;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PoolRedemptionStatus = "pending" | "approved" | "rejected" | "settled" | "failed";

export type PoolRedemptionRequest = {
  id: string;
  storeId: number;
  requesterUserId?: number;
  biaId: string;
  chainId: number;
  poolAddress: `0x${string}`;
  settlementAsset: string;
  tokenAmount: number;
  settlementAmount?: number;
  status: PoolRedemptionStatus;
  approvedBy?: number;
  approvedAt?: string;
  settledBy?: number;
  settledAt?: string;
  txHash?: string;
  rejectionReason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BiaHealthSnapshot = {
  biaId: string;
  citySlug: string;
  code: string;
  name: string;
  status: BiaStatus;
  chainId?: number;
  poolAddress?: `0x${string}`;
  mappingStatus?: BiaPoolMappingStatus;
  validationStatus?: BiaPoolValidationStatus;
  purchaseCount: number;
  purchasedTokenVolume: number;
  pendingRedemptionCount: number;
  pendingRedemptionVolume: number;
  settledRedemptionCount: number;
  settledRedemptionVolume: number;
  indexedEvents: number;
  indexedVolumeIn: number;
  indexedVolumeOut: number;
  lastIndexedBlock?: number;
  redemptionPressure: number;
  concentrationScore: number;
  stressLevel: "low" | "medium" | "high";
  riskGeneratedAt?: string;
};

export type BiaIndexerHealth = {
  activeBias: number;
  mappedPools: number;
  unmappedPools: number;
  staleMappings: number;
  lastActivityByBia: Array<{
    biaId: string;
    biaCode: string;
    biaName: string;
    lastIndexedBlock?: number;
    indexedEventCount: number;
  }>;
};
