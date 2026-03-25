import { createPublicClient, getAddress, type Address } from "viem";
import {
  createTorontoCoinPublicClient,
  getTorontoCoinTrackedPoolStatuses,
  type TorontoCoinTrackedPoolStatus,
} from "./torontocoinPools";
import {
  getTorontoCoinRpcUrl,
  TORONTOCOIN_RUNTIME,
  type TorontoCoinRuntimeConfig,
} from "./torontocoinRuntime";

const ownableAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const reserveRegistryReadAbi = [
  {
    type: "function",
    name: "isReserveAssetActive",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const reserveInputRouterReadAbi = [
  {
    type: "function",
    name: "liquidityRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const treasuryControllerReadAbi = [
  {
    type: "function",
    name: "liquidityRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const mentoBrokerSwapAdapterReadAbi = [
  {
    type: "function",
    name: "getDefaultRouteConfig",
    stateMutability: "view",
    inputs: [{ name: "tokenIn", type: "address" }],
    outputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "intermediateToken", type: "address" },
      { name: "secondExchangeProvider", type: "address" },
      { name: "secondExchangeId", type: "bytes32" },
      { name: "configured", type: "bool" },
    ],
  },
] as const;

export type TorontoCoinOpsCoreStatus = {
  addresses: {
    chainId: number;
    governance: Address;
    treasuryController: Address;
    liquidityRouter: Address;
    poolRegistry: Address;
    reserveRegistry: Address;
    reserveInputRouter: Address;
    sarafuSwapPoolAdapter: Address;
    mentoBrokerSwapAdapter: Address;
    mrTcoin: Address;
    cplTcoin: Address;
    bootstrapSwapPool: Address;
    bootstrapPoolId: `0x${string}`;
    reserveAssetId: `0x${string}`;
    reserveAssetToken: Address;
    scenarioInputToken: Address;
    trackedPoolCount: number;
  };
  ownership: {
    liquidityRouter: { owner: Address; healthy: boolean };
    treasuryController: { owner: Address; healthy: boolean };
    poolRegistry: { owner: Address; healthy: boolean };
    sarafuSwapPoolAdapter: { owner: Address; healthy: boolean };
  };
  pools: TorontoCoinTrackedPoolStatus[];
  reserveRouteHealth: {
    reserveAssetActive: boolean;
    mentoUsdcRouteConfigured: boolean;
    liquidityRouterPointerHealthy: boolean;
    treasuryControllerPointerHealthy: boolean;
  };
  artifactTimestamps: {
    deployedAt: number;
    validatedAt: number;
  };
};

async function readOwner(
  client: ReturnType<typeof createPublicClient>,
  address: Address,
  governance: Address
) {
  const owner = getAddress(
    await client.readContract({
      address,
      abi: ownableAbi,
      functionName: "owner",
    })
  );
  return { owner, healthy: owner.toLowerCase() === governance.toLowerCase() };
}

export async function getTorontoCoinOpsStatus(
  runtime: TorontoCoinRuntimeConfig = TORONTOCOIN_RUNTIME
): Promise<TorontoCoinOpsCoreStatus> {
  const client = createTorontoCoinPublicClient(runtime);

  const [
    liquidityRouterOwner,
    treasuryControllerOwner,
    poolRegistryOwner,
    sarafuSwapPoolAdapterOwner,
    reserveAssetActive,
    reserveInputRouterPointer,
    treasuryControllerLiquidityRouter,
    mentoRouteConfig,
    pools,
  ] = await Promise.all([
    readOwner(client, runtime.liquidityRouter, runtime.governance),
    readOwner(client, runtime.treasuryController, runtime.governance),
    readOwner(client, runtime.poolRegistry, runtime.governance),
    readOwner(client, runtime.sarafuSwapPoolAdapter, runtime.governance),
    client.readContract({
      address: runtime.reserveRegistry,
      abi: reserveRegistryReadAbi,
      functionName: "isReserveAssetActive",
      args: [runtime.reserveAssetId],
    }),
    client.readContract({
      address: runtime.reserveInputRouter,
      abi: reserveInputRouterReadAbi,
      functionName: "liquidityRouter",
    }),
    client.readContract({
      address: runtime.treasuryController,
      abi: treasuryControllerReadAbi,
      functionName: "liquidityRouter",
    }),
    client.readContract({
      address: runtime.mentoBrokerSwapAdapter,
      abi: mentoBrokerSwapAdapterReadAbi,
      functionName: "getDefaultRouteConfig",
      args: [runtime.scenarioInputToken],
    }),
    getTorontoCoinTrackedPoolStatuses({ client, runtime }),
  ]);

  const [, , , , , mentoConfigured] = mentoRouteConfig;

  return {
    addresses: {
      chainId: runtime.chainId,
      governance: runtime.governance,
      treasuryController: runtime.treasuryController,
      liquidityRouter: runtime.liquidityRouter,
      poolRegistry: runtime.poolRegistry,
      reserveRegistry: runtime.reserveRegistry,
      reserveInputRouter: runtime.reserveInputRouter,
      sarafuSwapPoolAdapter: runtime.sarafuSwapPoolAdapter,
      mentoBrokerSwapAdapter: runtime.mentoBrokerSwapAdapter,
      mrTcoin: runtime.mrTcoin.address,
      cplTcoin: runtime.cplTcoin.address,
      bootstrapSwapPool: runtime.bootstrapSwapPool,
      bootstrapPoolId: runtime.bootstrapPoolId,
      reserveAssetId: runtime.reserveAssetId,
      reserveAssetToken: runtime.reserveAssetToken,
      scenarioInputToken: runtime.scenarioInputToken,
      trackedPoolCount: pools.length,
    },
    ownership: {
      liquidityRouter: liquidityRouterOwner,
      treasuryController: treasuryControllerOwner,
      poolRegistry: poolRegistryOwner,
      sarafuSwapPoolAdapter: sarafuSwapPoolAdapterOwner,
    },
    pools,
    reserveRouteHealth: {
      reserveAssetActive,
      mentoUsdcRouteConfigured: mentoConfigured,
      liquidityRouterPointerHealthy:
        getAddress(reserveInputRouterPointer).toLowerCase() === runtime.liquidityRouter.toLowerCase(),
      treasuryControllerPointerHealthy:
        getAddress(treasuryControllerLiquidityRouter).toLowerCase() === runtime.liquidityRouter.toLowerCase(),
    },
    artifactTimestamps: {
      deployedAt: runtime.deployedAt,
      validatedAt: runtime.validatedAt,
    },
  };
}
