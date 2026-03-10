import type { Address } from "viem";

export type IndexerRunStatus = "idle" | "running" | "success" | "error" | "skipped";
export type IndexerSource = "tracker" | "rpc";
export type ContractKey = "TCOIN" | "TTC" | "CAD" | "ORCHESTRATOR" | "VOTING";

export type CityContracts = Partial<Record<ContractKey, Address>>;

export type CityContractSet = {
  citySlug: string;
  cityVersion: number;
  chainId: number;
  contracts: CityContracts;
  metadataURI?: string;
};

export type TrackedPoolLink = {
  citySlug: string;
  cityVersion: number;
  chainId: number;
  poolAddress: Address;
  tokenRegistry?: Address;
  tokenLimiter?: Address;
  quoter?: Address;
  ownerAddress?: Address;
  feeAddress?: Address;
  isActive: boolean;
  tokenAddresses: Address[];
  poolName?: string;
  poolSymbol?: string;
};

export type TrackerEvent = {
  block: number;
  contractAddress: string;
  success: boolean;
  timestamp: number;
  transactionHash: string;
  transactionType: string;
  payload: Record<string, unknown>;
  logIndex?: number;
};

export type NormalizedEvent = {
  source: IndexerSource;
  chainId: number;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  contractAddress: Address;
  success: boolean;
  timestamp: number;
  transactionType: string;
  payload: Record<string, unknown>;
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
    source: IndexerSource;
    lastBlock: number;
    lastTxHash: string | null;
    updatedAt: string;
  }>;
  activePoolCount: number;
  activeTokenCount: number;
};

export type IndexerTouchResult = {
  scopeKey: string;
  started: boolean;
  skipped: boolean;
  reason?: string;
  nextEligibleAt?: string;
  runStatus?: IndexerRunStatus;
  error?: string;
  ingestion?: {
    source: IndexerSource;
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
