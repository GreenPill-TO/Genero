import { cityImplementationRegistryAbi } from "@shared/lib/contracts/management/abis";
import { getCityContext } from "@shared/lib/contracts/management/clients";
import { writeRegistryContractWithCubid } from "@shared/lib/contracts/management/writes";

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
    oracleRouter: `0x${string}`;
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
