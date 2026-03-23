export type IndexerRunStatus = "idle" | "running" | "success" | "error" | "skipped";

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
  skipped: boolean;
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
    requiredPoolAddress: string;
    requiredTokenAddress: string;
    bootstrapPoolTracked: boolean;
    cplTcoinTracked: boolean;
  };
};
