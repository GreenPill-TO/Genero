import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatUnits,
  parseAbi,
  type Address,
  type PublicClient,
  type Hex,
} from "viem";
import type { CityContractSet } from "./types";

const oracleRouterAbi = parseAbi([
  "function reserveRegistry() view returns (address)",
  "function getCadPrice(bytes32 assetId) view returns (uint256 price18, uint256 updatedAt, bool usedFallback)",
]);

const reserveRegistryAbi = parseAbi([
  "function getAssetIdByToken(address token) view returns (bytes32)",
]);

export type ExchangeRateIngestionResult = {
  state: "ready" | "empty" | "setup_required";
  citySlug: string;
  assetId: string | null;
  observedAt: string | null;
  usedFallback: boolean | null;
};

function isZeroAddress(address?: Address): boolean {
  return !address || address.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

function isZeroBytes32(value?: Hex): boolean {
  return !value || value.toLowerCase() === `0x${"0".repeat(64)}`;
}

async function resolveCitycoinMetadata(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
}) {
  const { data, error } = await options.supabase
    .from("ref_citycoins")
    .select("id,symbol")
    .eq("slug", options.citySlug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve city coin metadata: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`City coin '${options.citySlug}' was not found.`);
  }

  return {
    citycoinId: Number(data.id),
    symbol: String(data.symbol ?? options.citySlug).toUpperCase(),
  };
}

async function loadLatestRateSnapshot(options: {
  supabase: SupabaseClient<any, any, any>;
  citycoinId: number;
}) {
  const { data, error } = await options.supabase
    .from("citycoin_exchange_rates")
    .select("rate,observed_at,asset_id,used_fallback")
    .eq("citycoin_id", options.citycoinId)
    .order("observed_at", { ascending: false })
    .order("indexed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read latest city exchange-rate snapshot: ${error.message}`);
  }

  return data;
}

export async function ingestCityExchangeRate(options: {
  supabase: SupabaseClient<any, any, any>;
  client: PublicClient;
  citySlug: string;
  cityContracts: CityContractSet;
}): Promise<ExchangeRateIngestionResult> {
  const oracleRouter = options.cityContracts.contracts.ORACLE_ROUTER;
  const tcoinToken = options.cityContracts.contracts.TCOIN;

  if (isZeroAddress(oracleRouter)) {
    return {
      state: "setup_required",
      citySlug: options.citySlug,
      assetId: null,
      observedAt: null,
      usedFallback: null,
    };
  }

  if (isZeroAddress(tcoinToken)) {
    return {
      state: "setup_required",
      citySlug: options.citySlug,
      assetId: null,
      observedAt: null,
      usedFallback: null,
    };
  }

  const oracleRouterAddress = oracleRouter as Address;
  const tcoinTokenAddress = tcoinToken as Address;

  const reserveRegistry = (await options.client.readContract({
    address: oracleRouterAddress,
    abi: oracleRouterAbi,
    functionName: "reserveRegistry",
  })) as Address;

  if (isZeroAddress(reserveRegistry)) {
    return {
      state: "setup_required",
      citySlug: options.citySlug,
      assetId: null,
      observedAt: null,
      usedFallback: null,
    };
  }

  const assetId = (await options.client.readContract({
    address: reserveRegistry,
    abi: reserveRegistryAbi,
    functionName: "getAssetIdByToken",
    args: [tcoinTokenAddress],
  })) as Hex;

  if (isZeroBytes32(assetId)) {
    return {
      state: "setup_required",
      citySlug: options.citySlug,
      assetId: null,
      observedAt: null,
      usedFallback: null,
    };
  }

  const [price18, updatedAt, usedFallback] = (await options.client.readContract({
    address: oracleRouterAddress,
    abi: oracleRouterAbi,
    functionName: "getCadPrice",
    args: [assetId],
  })) as readonly [bigint, bigint, boolean];

  const observedAt = new Date(Number(updatedAt) * 1000).toISOString();
  const rate = Number(formatUnits(price18, 18));
  const metadata = await resolveCitycoinMetadata({
    supabase: options.supabase,
    citySlug: options.citySlug,
  });

  const latestSnapshot = await loadLatestRateSnapshot({
    supabase: options.supabase,
    citycoinId: metadata.citycoinId,
  });

  const latestRate = latestSnapshot?.rate == null ? null : Number(latestSnapshot.rate);
  const shouldInsert =
    latestSnapshot == null ||
    latestSnapshot.asset_id !== assetId ||
    latestSnapshot.observed_at !== observedAt ||
    latestRate == null ||
    Math.abs(latestRate - rate) > Number.EPSILON ||
    Boolean(latestSnapshot.used_fallback) !== usedFallback;

  if (shouldInsert) {
    const { error } = await options.supabase.from("citycoin_exchange_rates").insert({
      citycoin_id: metadata.citycoinId,
      source: "oracle_router",
      asset_id: assetId,
      rate,
      base_currency: "CAD",
      quote_symbol: metadata.symbol,
      observed_at: observedAt,
      used_fallback: usedFallback,
      metadata: {
        citySlug: options.citySlug,
        oracleRouter: oracleRouterAddress,
        reserveRegistry,
        tokenAddress: tcoinTokenAddress,
      },
    });

    if (error) {
      throw new Error(`Failed to persist city exchange-rate snapshot: ${error.message}`);
    }
  }

  return {
    state: "ready",
    citySlug: options.citySlug,
    assetId,
    observedAt,
    usedFallback,
  };
}
