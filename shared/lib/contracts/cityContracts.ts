import { keccak256, stringToBytes, type Hex } from "viem";
import { cityRegistryAbi } from "@shared/lib/contracts/cityRegistryAbi";
import {
  CITY_REGISTRY_BOOTSTRAP,
  getCityRegistryPublicClient,
} from "@shared/lib/contracts/cityRegistryClient";

export type ContractKey = "TCOIN" | "TTC" | "CAD" | "ORCHESTRATOR" | "VOTING";

export type ActiveCityContracts = {
  citySlug: string;
  cityId: Hex;
  version: number;
  chainId: number;
  contracts: Record<ContractKey, Hex>;
  metadataURI: string;
  promotedAt: number;
};

type CacheRecord = {
  expiresAt: number;
  data: ActiveCityContracts;
};

type RegistryActiveRecord = {
  version: bigint;
  createdAt: bigint;
  promotedAt: bigint;
  chainId: bigint;
  contracts: {
    tcoin: Hex;
    ttc: Hex;
    cad: Hex;
    orchestrator: Hex;
    voting: Hex;
  };
  metadataURI: string;
  exists: boolean;
};

const ACTIVE_CACHE_TTL_MS = 60_000;
const LOCAL_CACHE_PREFIX = "city-contracts:v1:";

const memoryCache = new Map<string, CacheRecord>();

const CHAIN_RPC_URLS: Record<number, string> = {
  545: "https://testnet.evm.nodes.onflow.org",
};

export function getRpcUrlForChainId(chainId: number): string {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) {
    throw new Error(`No configured RPC URL for chainId ${chainId}. Add it to CHAIN_RPC_URLS.`);
  }
  return rpcUrl;
}

export function normaliseCitySlug(citySlug: string): string {
  const slug = citySlug.trim().toLowerCase();
  if (!slug) {
    throw new Error("City slug cannot be empty.");
  }
  return slug;
}

export function citySlugToCityId(citySlug: string): Hex {
  return keccak256(stringToBytes(normaliseCitySlug(citySlug)));
}

function resolveCitySlug(explicitCitySlug?: string): string {
  if (explicitCitySlug) {
    return normaliseCitySlug(explicitCitySlug);
  }

  const envCitySlug = process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin";
  return normaliseCitySlug(envCitySlug);
}

function localStorageKey(citySlug: string): string {
  return `${LOCAL_CACHE_PREFIX}${citySlug}`;
}

function readLocalCache(citySlug: string): CacheRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(localStorageKey(citySlug));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheRecord;
    if (!parsed || typeof parsed.expiresAt !== "number" || !parsed.data) {
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(citySlug: string, record: CacheRecord) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(localStorageKey(citySlug), JSON.stringify(record));
}

function toSafeNumber(value: bigint, fieldName: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Field ${fieldName} exceeds Number.MAX_SAFE_INTEGER.`);
  }
  return Number(value);
}

function toActiveCityContracts(
  citySlug: string,
  cityId: Hex,
  record: RegistryActiveRecord
): ActiveCityContracts {
  if (!record.exists) {
    throw new Error(`No active contracts are registered for city slug '${citySlug}'.`);
  }

  return {
    citySlug,
    cityId,
    version: toSafeNumber(record.version, "version"),
    chainId: toSafeNumber(record.chainId, "chainId"),
    contracts: {
      TCOIN: record.contracts.tcoin,
      TTC: record.contracts.ttc,
      CAD: record.contracts.cad,
      ORCHESTRATOR: record.contracts.orchestrator,
      VOTING: record.contracts.voting,
    },
    metadataURI: record.metadataURI,
    promotedAt: toSafeNumber(record.promotedAt, "promotedAt"),
  };
}

export async function getActiveCityContracts(options?: {
  citySlug?: string;
  forceRefresh?: boolean;
}): Promise<ActiveCityContracts> {
  const citySlug = resolveCitySlug(options?.citySlug);
  const now = Date.now();

  if (!options?.forceRefresh) {
    const memoryRecord = memoryCache.get(citySlug);
    if (memoryRecord && now < memoryRecord.expiresAt) {
      return memoryRecord.data;
    }

    const localRecord = readLocalCache(citySlug);
    if (localRecord) {
      memoryCache.set(citySlug, localRecord);
      return localRecord.data;
    }
  }

  const cityId = citySlugToCityId(citySlug);
  const registryClient = getCityRegistryPublicClient();
  const record = (await registryClient.readContract({
    address: CITY_REGISTRY_BOOTSTRAP.address,
    abi: cityRegistryAbi,
    functionName: "getActiveContracts",
    args: [cityId],
  })) as RegistryActiveRecord;

  const data = toActiveCityContracts(citySlug, cityId, record);
  const cacheRecord = { data, expiresAt: now + ACTIVE_CACHE_TTL_MS };
  memoryCache.set(citySlug, cacheRecord);
  writeLocalCache(citySlug, cacheRecord);

  return data;
}

export function clearActiveCityContractsCache(citySlug?: string): void {
  if (citySlug) {
    const slug = normaliseCitySlug(citySlug);
    memoryCache.delete(slug);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(localStorageKey(slug));
    }
    return;
  }

  memoryCache.clear();
  if (typeof window !== "undefined") {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LOCAL_CACHE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  }
}
