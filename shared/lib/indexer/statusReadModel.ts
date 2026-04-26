import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getConfiguredTorontoCoinTrackedPools,
  getTorontoCoinWalletToken,
  TORONTOCOIN_RUNTIME,
} from "@shared/lib/contracts/torontocoinRuntime";
import type { IndexerScopeStatus } from "./types";

type RpcActivePoolDetail = {
  poolAddress?: string | null;
  tokenAddresses?: string[] | null;
};

type RpcIndexerScopeStatus = IndexerScopeStatus & {
  activePoolDetails?: RpcActivePoolDetail[];
};

type IndexerScopeStatusReadOptions = {
  supabase: SupabaseClient;
  citySlug?: string | null;
  chainId?: number | null;
  requiredTokenAddress?: string | null;
};

function normaliseCitySlug(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || trimmed === "undefined") {
    return "";
  }

  return trimmed;
}

function getConfiguredCitySlug() {
  return normaliseCitySlug(process.env.NEXT_PUBLIC_CITYCOIN) || TORONTOCOIN_RUNTIME.citySlug;
}

function getConfiguredChainId() {
  const configuredChainId = Number(process.env.INDEXER_CHAIN_ID ?? "");
  return Number.isFinite(configuredChainId) && configuredChainId > 0
    ? configuredChainId
    : TORONTOCOIN_RUNTIME.chainId;
}

function normaliseAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function stripInternalPoolDetails(status: RpcIndexerScopeStatus): IndexerScopeStatus {
  const { activePoolDetails: _activePoolDetails, ...safeStatus } = status;
  return safeStatus;
}

function enrichTorontoCoinTracking(status: RpcIndexerScopeStatus): IndexerScopeStatus {
  const runtimePools = getConfiguredTorontoCoinTrackedPools({
    citySlug: status.citySlug,
    chainId: status.chainId,
  });

  if (runtimePools.length === 0) {
    return stripInternalPoolDetails(status);
  }

  const activePoolsByAddress = new Map(
    (status.activePoolDetails ?? [])
      .filter((detail) => Boolean(detail.poolAddress))
      .map((detail) => [normaliseAddress(detail.poolAddress), detail])
  );
  const trackedPools = runtimePools.map((pool) => {
    const poolDetail = activePoolsByAddress.get(normaliseAddress(pool.poolAddress));
    const tokenAddresses = poolDetail?.tokenAddresses ?? [];
    const tracked = Boolean(poolDetail);

    return {
      poolId: pool.poolId,
      poolAddress: pool.poolAddress,
      expected: pool.expectedIndexerVisibility,
      tracked,
      tokenAddresses,
      healthy: !pool.expectedIndexerVisibility || tracked,
    };
  });

  return {
    ...stripInternalPoolDetails(status),
    torontoCoinTracking: {
      requiredTokenAddress: status.torontoCoinTracking?.requiredTokenAddress ?? "",
      cplTcoinTracked: status.torontoCoinTracking?.cplTcoinTracked ?? false,
      trackedPools,
    },
  };
}

export async function getIndexerScopeStatusReadModel(
  options: IndexerScopeStatusReadOptions
): Promise<IndexerScopeStatus> {
  const citySlug = normaliseCitySlug(options.citySlug) || getConfiguredCitySlug();
  const chainId = options.chainId ?? getConfiguredChainId();
  const requiredTokenAddress =
    options.requiredTokenAddress ??
    getTorontoCoinWalletToken({ citySlug, chainId })?.address ??
    null;

  const { data, error } = await options.supabase.rpc("indexer_scope_status_v1", {
    p_city_slug: citySlug,
    p_chain_id: chainId,
    p_required_token_address: requiredTokenAddress,
  });

  if (error) {
    throw new Error(`Failed to load indexer scope status: ${error.message}`);
  }

  return enrichTorontoCoinTracking(data as RpcIndexerScopeStatus);
}
