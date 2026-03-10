export type IndexerRunStatus = "idle" | "running" | "success" | "error" | "skipped";

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
};
