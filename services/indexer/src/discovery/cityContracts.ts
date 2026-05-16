import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress, type Address } from "viem";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { getTorontoCoinRuntimeConfig } from "@shared/lib/contracts/torontocoinRuntime";
import type { CityContractSet, ContractKey } from "../types";

function maybeAddress(value: unknown): Address | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return undefined;
  }

  const checksummed = getAddress(trimmed);
  if (checksummed === "0x0000000000000000000000000000000000000000") {
    return undefined;
  }

  return checksummed;
}

function toContractRecord(record: Record<string, unknown>): Partial<Record<ContractKey, Address>> {
  const contracts: Partial<Record<ContractKey, Address>> = {};

  const pairs: Array<[ContractKey, unknown]> = [
    ["TCOIN", record.tcoin],
    ["TTC", record.ttc],
    ["CAD", record.cad],
    ["ORCHESTRATOR", record.orchestrator],
    ["ORACLE_ROUTER", record.oracleRouter],
    ["VOTING", record.voting],
  ];

  for (const [key, value] of pairs) {
    const address = maybeAddress(value);
    if (address) {
      contracts[key] = address;
    }
  }

  return contracts;
}

export async function resolveCityContractSet(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
}): Promise<CityContractSet> {
  const { supabase, citySlug, chainId } = options;
  const normalizedSlug = citySlug.trim().toLowerCase();
  const torontoCoinRuntime = getTorontoCoinRuntimeConfig({
    citySlug: normalizedSlug,
    chainId,
  });

  try {
    const activeContracts = await getActiveCityContracts({ citySlug: normalizedSlug, forceRefresh: true });
    if (activeContracts.chainId === chainId) {
      return {
        citySlug: normalizedSlug,
        chainId,
        cityVersion: activeContracts.version,
        contracts: {
          TCOIN: activeContracts.contracts.TCOIN,
          TTC: activeContracts.contracts.TTC,
          CAD: activeContracts.contracts.CAD,
          ORCHESTRATOR: activeContracts.contracts.ORCHESTRATOR,
          ORACLE_ROUTER: activeContracts.contracts.ORACLE_ROUTER,
          VOTING: activeContracts.contracts.VOTING,
        },
        metadataURI: activeContracts.metadataURI,
        torontoCoinRuntime: torontoCoinRuntime
          ? {
              chainId: torontoCoinRuntime.chainId,
              liquidityRouter: torontoCoinRuntime.liquidityRouter,
              poolRegistry: torontoCoinRuntime.poolRegistry,
              reserveRegistry: torontoCoinRuntime.reserveRegistry,
              reserveInputRouter: torontoCoinRuntime.reserveInputRouter,
              sarafuSwapPoolAdapter: torontoCoinRuntime.sarafuSwapPoolAdapter,
              mentoBrokerSwapAdapter: torontoCoinRuntime.mentoBrokerSwapAdapter,
              mrTcoin: torontoCoinRuntime.mrTcoin.address,
              cplTcoin: torontoCoinRuntime.cplTcoin.address,
              bootstrapPoolId: torontoCoinRuntime.bootstrapPoolId,
              bootstrapSwapPool: torontoCoinRuntime.bootstrapSwapPool,
              trackedPools: torontoCoinRuntime.trackedPools.map((pool) => ({
                poolId: pool.poolId,
                poolAddress: pool.poolAddress,
                name: pool.name,
              })),
            }
          : undefined,
      };
    }
  } catch {
    // Fallback to DB bootstrap overrides if registry is not configured yet.
  }

  const { data, error } = await supabase
    .schema("indexer")
    .from("city_contract_overrides")
    .select(
      "city_version,tcoin_address,ttc_address,cad_address,orchestrator_address,oracle_router_address,voting_address,metadata_uri"
    )
    .eq("city_slug", normalizedSlug)
    .eq("chain_id", chainId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read city contract override: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      `No active city contracts were resolved for ${normalizedSlug} on chain ${chainId}. Configure city registry bootstrap or add indexer.city_contract_overrides.`
    );
  }

  const contracts = toContractRecord({
    tcoin: data.tcoin_address,
    ttc: data.ttc_address,
    cad: data.cad_address,
    orchestrator: data.orchestrator_address,
    oracleRouter: data.oracle_router_address,
    voting: data.voting_address,
  });

  if (!contracts.TCOIN) {
    throw new Error(
      `City contract override for ${normalizedSlug}:${chainId} is missing TCOIN address.`
    );
  }

  return {
    citySlug: normalizedSlug,
    chainId,
    cityVersion: Number(data.city_version ?? 1),
    contracts,
    metadataURI: data.metadata_uri ?? undefined,
    torontoCoinRuntime: torontoCoinRuntime
      ? {
          chainId: torontoCoinRuntime.chainId,
          liquidityRouter: torontoCoinRuntime.liquidityRouter,
          poolRegistry: torontoCoinRuntime.poolRegistry,
          reserveRegistry: torontoCoinRuntime.reserveRegistry,
          reserveInputRouter: torontoCoinRuntime.reserveInputRouter,
          sarafuSwapPoolAdapter: torontoCoinRuntime.sarafuSwapPoolAdapter,
          mentoBrokerSwapAdapter: torontoCoinRuntime.mentoBrokerSwapAdapter,
          mrTcoin: torontoCoinRuntime.mrTcoin.address,
          cplTcoin: torontoCoinRuntime.cplTcoin.address,
          bootstrapPoolId: torontoCoinRuntime.bootstrapPoolId,
          bootstrapSwapPool: torontoCoinRuntime.bootstrapSwapPool,
          trackedPools: torontoCoinRuntime.trackedPools.map((pool) => ({
            poolId: pool.poolId,
            poolAddress: pool.poolAddress,
            name: pool.name,
          })),
        }
      : undefined,
  };
}
