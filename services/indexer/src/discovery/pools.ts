import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAddress,
  isAddress,
  type Address,
  type PublicClient,
} from "viem";
import {
  DEFAULT_DISCOVERY_POOL_LIMIT,
  REQUIRED_POOL_ADDRESSES,
  REQUIRED_POOL_COMPONENTS,
  SARAFU_POOL_INDEX_ADDRESS,
} from "../config";
import { erc20MetadataAbi, poolAbi, poolIndexAbi, poolRegistryAbi, tokenRegistryAbi } from "./abis";
import type { CityContractSet, TrackedPoolLink } from "../types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type PoolDetails = {
  poolAddress: Address;
  tokenRegistry?: Address;
  tokenLimiter?: Address;
  quoter?: Address;
  ownerAddress?: Address;
  feeAddress?: Address;
  poolName?: string;
  poolSymbol?: string;
  tokenAddresses: Address[];
};

function toAddress(value: unknown): Address | undefined {
  if (typeof value !== "string" || !isAddress(value)) {
    return undefined;
  }

  const checksummed = getAddress(value);
  if (checksummed.toLowerCase() === ZERO_ADDRESS) {
    return undefined;
  }

  return checksummed;
}

async function readContractAddress(options: {
  client: PublicClient;
  address: Address;
  functionName: "tokenRegistry" | "tokenLimiter" | "quoter" | "owner" | "feeAddress";
}): Promise<Address | undefined> {
  try {
    const value = await options.client.readContract({
      address: options.address,
      abi: poolAbi,
      functionName: options.functionName,
    });

    return toAddress(value);
  } catch {
    return undefined;
  }
}

async function readContractString(options: {
  client: PublicClient;
  address: Address;
  functionName: "name" | "symbol";
}): Promise<string | undefined> {
  try {
    const value = await options.client.readContract({
      address: options.address,
      abi: poolAbi,
      functionName: options.functionName,
    });

    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

async function readEntryCount(client: PublicClient, address: Address): Promise<number> {
  const value = await client.readContract({
    address,
    abi: tokenRegistryAbi,
    functionName: "entryCount",
  });

  return Number(value);
}

async function readAddressEntry(options: {
  client: PublicClient;
  address: Address;
  index: number;
  usePoolIndexAbi: boolean;
}): Promise<Address | undefined> {
  const abi = options.usePoolIndexAbi ? poolIndexAbi : tokenRegistryAbi;

  for (const functionName of ["entry", "entries"] as const) {
    try {
      const value = await options.client.readContract({
        address: options.address,
        abi,
        functionName,
        args: [BigInt(options.index)],
      });

      const direct = toAddress(value);
      if (direct) {
        return direct;
      }

      if (Array.isArray(value)) {
        const maybeTupleAddress = value.find((part) => typeof part === "string" && isAddress(part));
        if (typeof maybeTupleAddress === "string") {
          return getAddress(maybeTupleAddress);
        }
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

export function hasTokenOverlap(poolTokens: Address[], cityTokens: Address[]): boolean {
  if (poolTokens.length === 0 || cityTokens.length === 0) {
    return false;
  }

  const cityTokenSet = new Set(cityTokens.map((address) => address.toLowerCase()));
  return poolTokens.some((token) => cityTokenSet.has(token.toLowerCase()));
}

async function readPoolTokenAddresses(options: {
  client: PublicClient;
  tokenRegistry?: Address;
}): Promise<Address[]> {
  if (!options.tokenRegistry) {
    return [];
  }

  let entryCount: number;
  try {
    entryCount = await readEntryCount(options.client, options.tokenRegistry);
  } catch {
    return [];
  }

  const addresses: Address[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const entryAddress = await readAddressEntry({
      client: options.client,
      address: options.tokenRegistry,
      index,
      usePoolIndexAbi: false,
    });

    if (entryAddress) {
      addresses.push(entryAddress);
    }
  }

  return Array.from(new Set(addresses));
}

async function resolvePoolDetails(options: {
  client: PublicClient;
  poolAddress: Address;
}): Promise<PoolDetails> {
  const tokenRegistry = await readContractAddress({
    client: options.client,
    address: options.poolAddress,
    functionName: "tokenRegistry",
  });

  const [tokenLimiter, quoter, ownerAddress, feeAddress, poolName, poolSymbol] = await Promise.all([
    readContractAddress({
      client: options.client,
      address: options.poolAddress,
      functionName: "tokenLimiter",
    }),
    readContractAddress({
      client: options.client,
      address: options.poolAddress,
      functionName: "quoter",
    }),
    readContractAddress({
      client: options.client,
      address: options.poolAddress,
      functionName: "owner",
    }),
    readContractAddress({
      client: options.client,
      address: options.poolAddress,
      functionName: "feeAddress",
    }),
    readContractString({
      client: options.client,
      address: options.poolAddress,
      functionName: "name",
    }),
    readContractString({
      client: options.client,
      address: options.poolAddress,
      functionName: "symbol",
    }),
  ]);

  const tokenAddresses = await readPoolTokenAddresses({
    client: options.client,
    tokenRegistry,
  });

  return {
    poolAddress: options.poolAddress,
    tokenRegistry,
    tokenLimiter,
    quoter,
    ownerAddress,
    feeAddress,
    poolName,
    poolSymbol,
    tokenAddresses,
  };
}

async function readPoolAddresses(client: PublicClient, limit: number): Promise<Address[]> {
  let entryCount = 0;

  try {
    const value = await client.readContract({
      address: SARAFU_POOL_INDEX_ADDRESS,
      abi: poolIndexAbi,
      functionName: "entryCount",
    });

    entryCount = Number(value);
  } catch {
    entryCount = 0;
  }

  const cappedCount = Math.min(entryCount, limit);
  const poolAddresses: Address[] = [];

  for (let index = 0; index < cappedCount; index += 1) {
    const entryAddress = await readAddressEntry({
      client,
      address: SARAFU_POOL_INDEX_ADDRESS,
      index,
      usePoolIndexAbi: true,
    });

    if (entryAddress) {
      poolAddresses.push(entryAddress);
    }
  }

  return Array.from(new Set(poolAddresses));
}

async function readTorontoCoinRegisteredPoolAddresses(
  client: PublicClient,
  cityContracts: CityContractSet
): Promise<Address[]> {
  const poolRegistryAddress = cityContracts.torontoCoinRuntime?.poolRegistry;
  if (!poolRegistryAddress) {
    return [];
  }

  try {
    const poolIds = await client.readContract({
      address: poolRegistryAddress,
      abi: poolRegistryAbi,
      functionName: "listPoolIds",
    });

    const addresses = await Promise.all(
      poolIds.map(async (poolId) => {
        try {
          const poolAddress = await client.readContract({
            address: poolRegistryAddress,
            abi: poolRegistryAbi,
            functionName: "getPoolAddress",
            args: [poolId],
          });
          return toAddress(poolAddress);
        } catch {
          return undefined;
        }
      })
    );

    return Array.from(new Set(addresses.filter((value): value is Address => Boolean(value))));
  } catch {
    return [];
  }
}

async function upsertTokenMetadata(options: {
  supabase: SupabaseClient<any, any, any>;
  client: PublicClient;
  chainId: number;
  tokenAddresses: Address[];
}) {
  const rows = await Promise.all(
    options.tokenAddresses.map(async (tokenAddress) => {
      let tokenName: string | null = null;
      let tokenSymbol: string | null = null;
      let tokenDecimals: number | null = null;

      try {
        const [name, symbol, decimals] = await Promise.all([
          options.client.readContract({
            address: tokenAddress,
            abi: erc20MetadataAbi,
            functionName: "name",
          }),
          options.client.readContract({
            address: tokenAddress,
            abi: erc20MetadataAbi,
            functionName: "symbol",
          }),
          options.client.readContract({
            address: tokenAddress,
            abi: erc20MetadataAbi,
            functionName: "decimals",
          }),
        ]);

        tokenName = typeof name === "string" ? name : null;
        tokenSymbol = typeof symbol === "string" ? symbol : null;
        tokenDecimals = Number(decimals);
      } catch {
        // Metadata lookups are best effort.
      }

      return {
        chain_id: options.chainId,
        contract_address: tokenAddress,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        token_decimals: tokenDecimals,
        updated_at: new Date().toISOString(),
      };
    })
  );

  if (rows.length === 0) {
    return;
  }

  const { error } = await options.supabase
    .schema("chain_data")
    .from("tokens")
    .upsert(rows, { onConflict: "chain_id,contract_address" });

  if (error) {
    throw new Error(`Failed to upsert token metadata: ${error.message}`);
  }
}

export async function discoverTrackedPools(options: {
  supabase: SupabaseClient<any, any, any>;
  client: PublicClient;
  cityContracts: CityContractSet;
  poolLimit?: number;
}) {
  const { supabase, client, cityContracts } = options;
  const nowIso = new Date().toISOString();

  const poolLimit =
    typeof options.poolLimit === "number" && Number.isFinite(options.poolLimit)
      ? options.poolLimit
      : DEFAULT_DISCOVERY_POOL_LIMIT;

  const cityTokens = [
    cityContracts.contracts.TCOIN,
    cityContracts.contracts.TTC,
    cityContracts.contracts.CAD,
    cityContracts.torontoCoinRuntime?.mrTcoin,
    cityContracts.torontoCoinRuntime?.cplTcoin,
  ].filter((value): value is Address => Boolean(value));

  const [indexedPoolAddresses, registeredTorontoCoinPools] = await Promise.all([
    readPoolAddresses(client, poolLimit),
    readTorontoCoinRegisteredPoolAddresses(client, cityContracts),
  ]);
  const poolAddresses = Array.from(new Set([...indexedPoolAddresses, ...registeredTorontoCoinPools]));
  for (const requiredPool of REQUIRED_POOL_ADDRESSES) {
    if (!poolAddresses.some((existing) => existing.toLowerCase() === requiredPool.toLowerCase())) {
      poolAddresses.push(requiredPool);
    }
  }

  const discoveredLinks: TrackedPoolLink[] = [];
  const tokenAddressSet = new Set<string>();
  const trackedAddressSet = new Set<string>(cityTokens.map((address) => address.toLowerCase()));

  for (const poolAddress of poolAddresses) {
    const details = await resolvePoolDetails({ client, poolAddress });
    const isRequiredPool =
      poolAddress.toLowerCase() === REQUIRED_POOL_COMPONENTS.pool.toLowerCase();

    if (isRequiredPool) {
      details.tokenRegistry = details.tokenRegistry ?? REQUIRED_POOL_COMPONENTS.tokenRegistry;
      details.tokenLimiter = details.tokenLimiter ?? REQUIRED_POOL_COMPONENTS.tokenLimiter;
      details.quoter = details.quoter ?? REQUIRED_POOL_COMPONENTS.quoter;
      details.ownerAddress = details.ownerAddress ?? REQUIRED_POOL_COMPONENTS.feeAddress;
      details.feeAddress = details.feeAddress ?? REQUIRED_POOL_COMPONENTS.feeAddress;
    }

    const shouldInclude =
      hasTokenOverlap(details.tokenAddresses, cityTokens) ||
      isRequiredPool;

    if (!shouldInclude) {
      continue;
    }

    for (const tokenAddress of details.tokenAddresses) {
      tokenAddressSet.add(tokenAddress.toLowerCase());
      trackedAddressSet.add(tokenAddress.toLowerCase());
    }

    [
      details.poolAddress,
      details.tokenRegistry,
      details.tokenLimiter,
      details.quoter,
      details.ownerAddress,
      details.feeAddress,
    ]
      .filter((address): address is Address => Boolean(address))
      .forEach((address) => trackedAddressSet.add(address.toLowerCase()));

    discoveredLinks.push({
      citySlug: cityContracts.citySlug,
      cityVersion: cityContracts.cityVersion,
      chainId: cityContracts.chainId,
      poolAddress: details.poolAddress,
      tokenRegistry: details.tokenRegistry,
      tokenLimiter: details.tokenLimiter,
      quoter: details.quoter,
      ownerAddress: details.ownerAddress,
      feeAddress: details.feeAddress,
      isActive: true,
      tokenAddresses: details.tokenAddresses,
      poolName: details.poolName,
      poolSymbol: details.poolSymbol,
    });
  }

  const poolRows = discoveredLinks.map((link) => ({
    city_slug: link.citySlug,
    city_version: link.cityVersion,
    chain_id: link.chainId,
    pool_address: link.poolAddress,
    token_registry: link.tokenRegistry ?? null,
    token_limiter: link.tokenLimiter ?? null,
    quoter: link.quoter ?? null,
    owner_address: link.ownerAddress ?? null,
    fee_address: link.feeAddress ?? null,
    is_active: true,
    last_seen_at: nowIso,
    updated_at: nowIso,
  }));

  if (poolRows.length > 0) {
    const { error: poolLinkError } = await supabase
      .schema("indexer")
      .from("pool_links")
      .upsert(poolRows, { onConflict: "city_slug,chain_id,pool_address" });

    if (poolLinkError) {
      throw new Error(`Failed to upsert pool links: ${poolLinkError.message}`);
    }

    const poolMetaRows = discoveredLinks.map((link) => ({
      chain_id: link.chainId,
      contract_address: link.poolAddress,
      pool_name: link.poolName ?? null,
      pool_symbol: link.poolSymbol ?? null,
      updated_at: nowIso,
    }));

    const { error: poolMetaError } = await supabase
      .schema("chain_data")
      .from("pools")
      .upsert(poolMetaRows, { onConflict: "chain_id,contract_address" });

    if (poolMetaError) {
      throw new Error(`Failed to upsert pool metadata: ${poolMetaError.message}`);
    }
  }

  const poolTokenRows = discoveredLinks.flatMap((link) =>
    link.tokenAddresses.map((tokenAddress) => ({
      pool_address: link.poolAddress,
      token_address: tokenAddress,
      last_seen_at: nowIso,
    }))
  );

  if (poolTokenRows.length > 0) {
    const { error: poolTokenError } = await supabase
      .schema("indexer")
      .from("pool_tokens")
      .upsert(poolTokenRows, { onConflict: "pool_address,token_address" });

    if (poolTokenError) {
      throw new Error(`Failed to upsert pool tokens: ${poolTokenError.message}`);
    }
  }

  const { data: existingLinks, error: existingLinksError } = await supabase
    .schema("indexer")
    .from("pool_links")
    .select("pool_address")
    .eq("city_slug", cityContracts.citySlug)
    .eq("chain_id", cityContracts.chainId)
    .eq("is_active", true);

  if (existingLinksError) {
    throw new Error(`Failed to query existing active pool links: ${existingLinksError.message}`);
  }

  const activePoolSet = new Set(discoveredLinks.map((link) => link.poolAddress.toLowerCase()));
  const stalePools = (existingLinks ?? [])
    .map((row) => row.pool_address as string)
    .filter((poolAddress) => !activePoolSet.has(poolAddress.toLowerCase()));

  if (stalePools.length > 0) {
    const { error: deactivateError } = await supabase
      .schema("indexer")
      .from("pool_links")
      .update({ is_active: false, updated_at: nowIso })
      .eq("city_slug", cityContracts.citySlug)
      .eq("chain_id", cityContracts.chainId)
      .in("pool_address", stalePools);

    if (deactivateError) {
      throw new Error(`Failed to deactivate stale pools: ${deactivateError.message}`);
    }
  }

  const tokenAddresses = Array.from(tokenAddressSet).map((tokenAddress) => getAddress(tokenAddress));
  if (tokenAddresses.length > 0) {
    await upsertTokenMetadata({
      supabase,
      client,
      chainId: cityContracts.chainId,
      tokenAddresses,
    });
  }

  return {
    scannedPools: poolAddresses.length,
    activePools: discoveredLinks,
    trackedAddresses: Array.from(trackedAddressSet).map((address) => getAddress(address)),
  };
}
