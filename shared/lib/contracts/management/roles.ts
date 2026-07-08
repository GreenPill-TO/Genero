// @ts-nocheck
import { keccak256, stringToBytes } from "viem";
import { orchestratorV2Abi, accessControlTokenAbi } from "@shared/lib/contracts/management/abis";
import { getCityContext, getCityPublicClient, getRegistryPublicClient } from "@shared/lib/contracts/management/clients";
import type { ManagementRole, ManagementRoleResolution } from "@shared/lib/contracts/management/types";

const OWNER_ROLE = keccak256(stringToBytes("OWNER_ROLE"));

function makeFlags(roles: ManagementRole[]): Record<ManagementRole, boolean> {
  const set = new Set(roles);
  return {
    GOVERNANCE_STEWARD: set.has("GOVERNANCE_STEWARD"),
    CITY_MANAGER: set.has("CITY_MANAGER"),
    TREASURY_ADMIN: set.has("TREASURY_ADMIN"),
    TOKEN_ADMIN: set.has("TOKEN_ADMIN"),
    CHARITY_OPERATOR: set.has("CHARITY_OPERATOR"),
    REGISTRY_ADMIN: set.has("REGISTRY_ADMIN"),
  };
}

export async function resolveManagementRoles({
  walletAddress,
  citySlug,
}: {
  walletAddress: `0x${string}`;
  citySlug?: string;
}): Promise<ManagementRoleResolution> {
  const context = await getCityContext(citySlug);
  const cityClient = getCityPublicClient(context.chainId);

  const [orchestratorOwner, isSteward, isCharity, isTtcOwner, isCadOwner] = await Promise.all([
    cityClient.readContract({
      address: context.contracts.ORCHESTRATOR,
      abi: orchestratorV2Abi,
      functionName: "owner",
      args: [],
    }),
    cityClient.readContract({
      address: context.contracts.ORCHESTRATOR,
      abi: orchestratorV2Abi,
      functionName: "isSteward",
      args: [walletAddress],
    }),
    cityClient.readContract({
      address: context.contracts.ORCHESTRATOR,
      abi: orchestratorV2Abi,
      functionName: "isCharity",
      args: [walletAddress],
    }),
    cityClient.readContract({
      address: context.contracts.TTC,
      abi: accessControlTokenAbi,
      functionName: "hasRole",
      args: [OWNER_ROLE, walletAddress],
    }),
    cityClient.readContract({
      address: context.contracts.CAD,
      abi: accessControlTokenAbi,
      functionName: "hasRole",
      args: [OWNER_ROLE, walletAddress],
    }),
  ]);

  const roles: ManagementRole[] = [];

  if (Boolean(isSteward)) roles.push("GOVERNANCE_STEWARD");
  if (String(orchestratorOwner).toLowerCase() === walletAddress.toLowerCase()) {
    roles.push("CITY_MANAGER");
    roles.push("TREASURY_ADMIN");
  }
  if (Boolean(isTtcOwner) || Boolean(isCadOwner)) roles.push("TOKEN_ADMIN");
  if (Boolean(isCharity)) roles.push("CHARITY_OPERATOR");

  try {
    const registryClient = getRegistryPublicClient();
    const registryOwner = await registryClient.readContract({
      address: context.registry.address,
      abi: [
        {
          type: "function",
          name: "owner",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "address" }],
        },
      ],
      functionName: "owner",
      args: [],
    });

    if (String(registryOwner).toLowerCase() === walletAddress.toLowerCase()) {
      roles.push("REGISTRY_ADMIN");
    }
  } catch {
    // Registry might not be deployed/configured yet.
  }

  return {
    roles,
    flags: makeFlags(roles),
    context,
  };
}
