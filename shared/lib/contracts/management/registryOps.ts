// @ts-nocheck
import { cityImplementationRegistryAbi } from "@shared/lib/contracts/management/abis";
import {
  getCityContext,
  getRegistryPublicClient,
  writeRegistryContractWithCubid,
} from "@shared/lib/contracts/management/clients";

export async function getRegistrySnapshot(citySlug?: string) {
  const context = await getCityContext(citySlug);
  const client = getRegistryPublicClient();

  const [currentVersion, latestVersion, activeRecord] = await Promise.all([
    client.readContract({
      address: context.registry.address,
      abi: cityImplementationRegistryAbi,
      functionName: "getCurrentVersion",
      args: [context.cityId],
    }),
    client.readContract({
      address: context.registry.address,
      abi: cityImplementationRegistryAbi,
      functionName: "latestVersionByCity",
      args: [context.cityId],
    }),
    client.readContract({
      address: context.registry.address,
      abi: cityImplementationRegistryAbi,
      functionName: "getActiveContracts",
      args: [context.cityId],
    }),
  ]);

  return {
    context,
    currentVersion: Number(currentVersion),
    latestVersion: Number(latestVersion),
    activeRecord,
  };
}

export async function getVersionRecord({ citySlug, version }: { citySlug?: string; version: number }) {
  const context = await getCityContext(citySlug);
  const client = getRegistryPublicClient();
  return client.readContract({
    address: context.registry.address,
    abi: cityImplementationRegistryAbi,
    functionName: "getVersion",
    args: [context.cityId, version],
  });
}

export async function promoteVersion({
  citySlug,
  userId,
  version,
}: {
  citySlug?: string;
  userId: number;
  version: number;
}) {
  const context = await getCityContext(citySlug);
  return writeRegistryContractWithCubid({
    citySlug,
    userId,
    address: context.registry.address,
    abi: cityImplementationRegistryAbi,
    functionName: "promoteVersion",
    args: [context.cityId, version],
  });
}

export async function registerAndPromote({
  citySlug,
  userId,
  chainId,
  contracts,
  metadataURI,
}: {
  citySlug?: string;
  userId: number;
  chainId: number;
  contracts: {
    tcoin: `0x${string}`;
    ttc: `0x${string}`;
    cad: `0x${string}`;
    orchestrator: `0x${string}`;
    voting: `0x${string}`;
  };
  metadataURI: string;
}) {
  const context = await getCityContext(citySlug);
  return writeRegistryContractWithCubid({
    citySlug,
    userId,
    address: context.registry.address,
    abi: cityImplementationRegistryAbi,
    functionName: "registerAndPromote",
    args: [context.cityId, chainId, contracts, metadataURI],
  });
}
