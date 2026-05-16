// @ts-nocheck
import { createPublicClient, http } from "viem";
import {
  getActiveCityContracts,
  getRpcUrlForChainId,
  citySlugToCityId,
  normaliseCitySlug,
} from "@shared/lib/contracts/cityContracts";
import {
  getCityRegistryBootstrapConfig,
  getCityRegistryPublicClient,
} from "@shared/lib/contracts/cityRegistryClient";
import type { CityContext } from "@shared/lib/contracts/management/types";

export const isManagementWritesEnabled = () =>
  String(process.env.NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES || "").toLowerCase() === "true";

export async function getCityContext(citySlug?: string): Promise<CityContext> {
  const active = await getActiveCityContracts({ citySlug });
  const resolvedCitySlug = normaliseCitySlug(active.citySlug);
  const registry = getCityRegistryBootstrapConfig();

  return {
    citySlug: resolvedCitySlug,
    cityId: citySlugToCityId(resolvedCitySlug),
    version: active.version,
    chainId: active.chainId,
    metadataURI: active.metadataURI,
    contracts: active.contracts,
    rpcUrl: getRpcUrlForChainId(active.chainId),
    registry,
  };
}

export function getCityPublicClient(chainId: number) {
  return createPublicClient({ transport: http(getRpcUrlForChainId(chainId)) });
}

export async function readCityContract({
  citySlug,
  address,
  abi,
  functionName,
  args = [],
}: {
  citySlug?: string;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}) {
  const context = await getCityContext(citySlug);
  const client = getCityPublicClient(context.chainId);
  return client.readContract({ address, abi, functionName, args });
}

export function getRegistryPublicClient() {
  return getCityRegistryPublicClient();
}
