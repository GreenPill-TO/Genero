export type IndexerRunStatus = "idle" | "queued" | "running" | "success" | "error" | "skipped";

export type BiaScopeSummary = {
  activeBias: number;
  mappedPools: number;
  unmappedPools: number;
  staleMappings: number;
  componentMismatches: number;
  lastActivityByBia: Array<{
    biaId: string;
    biaCode: string;
    biaName: string;
    lastIndexedBlock: number | null;
    indexedEventCount: number;
  }>;
};

export type VoucherSummary = {
  trackedVoucherTokens: number;
  walletsWithVoucherBalances: number;
  merchantCreditRows: number;
  lastVoucherBlock: number | null;
};

export type IndexerTouchResponse = {
  scopeKey: string;
  started: boolean;
  queued?: boolean;
  skipped: boolean;
  requestId?: number;
  requestedAt?: string;
  reason?: string;
  nextEligibleAt?: string;
  runStatus?: IndexerRunStatus;
  error?: string;
  ingestion?: {
    source: "tracker" | "rpc";
    fromBlock: number;
    toBlock: number;
    eventsSeen: number;
    eventsPersisted: number;
  };
  discovery?: {
    scannedPools: number;
    activePools: number;
    trackedAddresses: number;
  };
  bia?: {
    mappedPools: number;
    unmappedPools: number;
    staleMappings: number;
    componentMismatches: number;
    rollupRows: number;
    riskSignals: number;
  };
  voucher?: VoucherSummary;
};

export type IndexerScopeStatus = {
  scopeKey: string;
  citySlug: string;
  chainId: number;
  runControl: {
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
    lastStatus: IndexerRunStatus;
    lastError: string | null;
    nextEligibleStartAt: string | null;
    nextEligibleCompleteAt: string | null;
    updatedAt: string;
  } | null;
  queue: {
    pendingRequestCount: number;
    oldestPendingRequestedAt: string | null;
    lastCompletedRequestAt: string | null;
    lastCompletedRequestStatus: Exclude<IndexerRunStatus, "idle"> | null;
    blocked: boolean;
    stale: boolean;
  };
  checkpoints: Array<{
    source: "tracker" | "rpc";
    lastBlock: number;
    lastTxHash: string | null;
    updatedAt: string;
  }>;
  activePoolCount: number;
  activeTokenCount: number;
  biaSummary: BiaScopeSummary;
  voucherSummary: VoucherSummary;
  torontoCoinTracking?: {
    requiredTokenAddress: string;
    cplTcoinTracked: boolean;
    trackedPools: Array<{
      poolId: string;
      poolAddress: string;
      expected: boolean;
      tracked: boolean;
      tokenAddresses: string[];
      healthy: boolean;
    }>;
  };
};
