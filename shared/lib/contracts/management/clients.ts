// @ts-nocheck
import { createPublicClient, http } from "viem";
import { ethers } from "ethers";
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
import { createCubidWalletSigner } from "@shared/lib/contracts/management/cubidSigner";

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

export async function writeCityContractWithCubid({
  citySlug,
  userId,
  address,
  abi,
  functionName,
  args = [],
}: {
  citySlug?: string;
  userId: number;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}) {
  if (!isManagementWritesEnabled()) {
    throw new Error(
      "Management writes are disabled. Set NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES=true to enable transactions."
    );
  }

  const context = await getCityContext(citySlug);
  const signer = await createCubidWalletSigner(userId, context.rpcUrl);
  const contract = new ethers.Contract(address, abi as any, signer);

  const tx = await contract[functionName](...(args as []));
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    chainId: context.chainId,
  };
}

export async function writeRegistryContractWithCubid({
  citySlug,
  userId,
  address,
  abi,
  functionName,
  args = [],
}: {
  citySlug?: string;
  userId: number;
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}) {
  if (!isManagementWritesEnabled()) {
    throw new Error(
      "Management writes are disabled. Set NEXT_PUBLIC_ENABLE_CONTRACT_MGMT_WRITES=true to enable transactions."
    );
  }

  const context = await getCityContext(citySlug);
  const signer = await createCubidWalletSigner(userId, context.registry.rpcUrl);
  const contract = new ethers.Contract(address, abi as any, signer);

  const tx = await contract[functionName](...(args as []));
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    chainId: context.registry.chainId,
  };
}

export function getRegistryPublicClient() {
  return getCityRegistryPublicClient();
}
