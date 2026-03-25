import type { Address } from "viem";
import { TORONTOCOIN_RUNTIME } from "@shared/lib/contracts/torontocoinRuntime";

export const INDEXER_COOLDOWN_SECONDS = 300;
export const INDEXER_CLIENT_COOLDOWN_MS = INDEXER_COOLDOWN_SECONDS * 1000;

export const DEFAULT_CITY_SLUG = (process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
export const DEFAULT_CHAIN_ID = Number(process.env.INDEXER_CHAIN_ID ?? 42220);
export const DEFAULT_CHAIN_RPC_URL = process.env.INDEXER_CHAIN_RPC_URL ?? "https://forno.celo.org";

export const DEFAULT_INITIAL_BLOCK = Number(process.env.INDEXER_INITIAL_BLOCK ?? 0);
export const DEFAULT_MAX_BLOCKS_PER_RUN = Number(process.env.INDEXER_MAX_BLOCKS_PER_RUN ?? 2_000);

export const DEFAULT_DISCOVERY_POOL_LIMIT = Number(process.env.INDEXER_DISCOVERY_POOL_LIMIT ?? 500);

export const TRACKER_PULL_URL = process.env.INDEXER_TRACKER_PULL_URL;

export const SARAFU_POOL_INDEX_ADDRESS =
  "0x01eD8Fe01a2Ca44Cb26D00b1309d7D777471D00C" as Address;

export const REQUIRED_POOL_ADDRESSES: readonly Address[] = [
  ...TORONTOCOIN_RUNTIME.trackedPools.map((pool) => pool.poolAddress),
] as const;

export const REQUIRED_POOL_COMPONENTS = {
  pool: TORONTOCOIN_RUNTIME.bootstrapSwapPool,
  feeAddress: "0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624" as Address,
  quoter: "0xdE91Ab8a327F1988B0Eb768f909dE8022b91De71" as Address,
  tokenRegistry: "0xa7645962B193Ec07E0FC9B6CaEcd31c64EBA5A6F" as Address,
  tokenLimiter: "0x250F96375332af6Dd512056B0046F033d2092e78" as Address,
};

export const REQUIRED_TCOIN_TOKEN = TORONTOCOIN_RUNTIME.cplTcoin.address;

export function toPositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveIndexerConfig() {
  return {
    citySlug: DEFAULT_CITY_SLUG,
    chainId: toPositiveNumber(DEFAULT_CHAIN_ID, 42220),
    rpcUrl: DEFAULT_CHAIN_RPC_URL,
    initialBlock: Math.max(0, Number.isFinite(DEFAULT_INITIAL_BLOCK) ? DEFAULT_INITIAL_BLOCK : 0),
    maxBlocksPerRun: toPositiveNumber(DEFAULT_MAX_BLOCKS_PER_RUN, 2_000),
    discoveryPoolLimit: toPositiveNumber(DEFAULT_DISCOVERY_POOL_LIMIT, 500),
    cooldownSeconds: INDEXER_COOLDOWN_SECONDS,
    trackerPullUrl: TRACKER_PULL_URL,
  };
}
