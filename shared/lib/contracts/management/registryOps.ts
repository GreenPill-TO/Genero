// @ts-nocheck
import { cityImplementationRegistryAbi } from "@shared/lib/contracts/management/abis";
import {
  getCityContext,
  getRegistryPublicClient,
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
