import { createPublicClient, formatUnits, getAddress, http, type Address, type Hex } from "viem";
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

const erc20ReadAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const liquidityRouterReadAbi = [
  {
    type: "function",
    name: "reserveInputRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "previewBuyCplTcoin",
    stateMutability: "view",
    inputs: [
      { name: "targetPoolId", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "inputAmount", type: "uint256" },
    ],
    outputs: [
      { name: "selectedPoolId", type: "bytes32" },
      { name: "reserveAssetId", type: "bytes32" },
      { name: "reserveAmountOut", type: "uint256" },
      { name: "mrTcoinOut", type: "uint256" },
      { name: "cplTcoinOut", type: "uint256" },
      { name: "charityTopupOut", type: "uint256" },
      { name: "resolvedCharityId", type: "uint256" },
      { name: "charityWallet", type: "address" },
    ],
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

export type TorontoCoinOpsStatus = {
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
    bootstrapPoolId: Hex;
    reserveAssetId: Hex;
    reserveAssetToken: Address;
    scenarioInputToken: Address;
  };
  ownership: {
    liquidityRouter: { owner: Address; healthy: boolean };
    treasuryController: { owner: Address; healthy: boolean };
    poolRegistry: { owner: Address; healthy: boolean };
    sarafuSwapPoolAdapter: { owner: Address; healthy: boolean };
  };
  poolLiquidity: {
    cplTcoinRaw: string;
    cplTcoinFormatted: string;
    mrTcoinRaw: string;
    mrTcoinFormatted: string;
  };
  scenarioPreview: {
    inputAmount: string;
    selectedPoolId: Hex;
    reserveAssetId: Hex;
    reserveAmountOut: string;
    reserveAmountOutFormatted: string;
    mrTcoinOut: string;
    mrTcoinOutFormatted: string;
    cplTcoinOut: string;
    cplTcoinOutFormatted: string;
    charityTopupOut: string;
    charityTopupOutFormatted: string;
    resolvedCharityId: string;
    charityWallet: Address;
  };
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
): Promise<TorontoCoinOpsStatus> {
  const client = createPublicClient({
    transport: http(getTorontoCoinRpcUrl()),
  });

  const [
    liquidityRouterOwner,
    treasuryControllerOwner,
    poolRegistryOwner,
    sarafuSwapPoolAdapterOwner,
    cplTcoinBalance,
    mrTcoinBalance,
    reserveAssetActive,
    reserveInputRouterPointer,
    treasuryControllerLiquidityRouter,
    mentoRouteConfig,
    preview,
  ] = await Promise.all([
    readOwner(client, runtime.liquidityRouter, runtime.governance),
    readOwner(client, runtime.treasuryController, runtime.governance),
    readOwner(client, runtime.poolRegistry, runtime.governance),
    readOwner(client, runtime.sarafuSwapPoolAdapter, runtime.governance),
    client.readContract({
      address: runtime.cplTcoin.address,
      abi: erc20ReadAbi,
      functionName: "balanceOf",
      args: [runtime.bootstrapSwapPool],
    }),
    client.readContract({
      address: runtime.mrTcoin.address,
      abi: erc20ReadAbi,
      functionName: "balanceOf",
      args: [runtime.bootstrapSwapPool],
    }),
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
    client.readContract({
      address: runtime.liquidityRouter,
      abi: liquidityRouterReadAbi,
      functionName: "previewBuyCplTcoin",
      args: [
        runtime.bootstrapPoolId,
        runtime.governance,
        runtime.scenarioInputToken,
        runtime.scenarioInputAmount,
      ],
    }),
  ]);

  const [
    selectedPoolId,
    reserveAssetId,
    reserveAmountOut,
    mrTcoinOut,
    cplTcoinOut,
    charityTopupOut,
    resolvedCharityId,
    charityWallet,
  ] = preview;
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
    },
    ownership: {
      liquidityRouter: liquidityRouterOwner,
      treasuryController: treasuryControllerOwner,
      poolRegistry: poolRegistryOwner,
      sarafuSwapPoolAdapter: sarafuSwapPoolAdapterOwner,
    },
    poolLiquidity: {
      cplTcoinRaw: cplTcoinBalance.toString(),
      cplTcoinFormatted: formatUnits(cplTcoinBalance, runtime.cplTcoin.decimals),
      mrTcoinRaw: mrTcoinBalance.toString(),
      mrTcoinFormatted: formatUnits(mrTcoinBalance, runtime.mrTcoin.decimals),
    },
    scenarioPreview: {
      inputAmount: runtime.scenarioInputAmount.toString(),
      selectedPoolId,
      reserveAssetId,
      reserveAmountOut: reserveAmountOut.toString(),
      reserveAmountOutFormatted: formatUnits(reserveAmountOut, 18),
      mrTcoinOut: mrTcoinOut.toString(),
      mrTcoinOutFormatted: formatUnits(mrTcoinOut, runtime.mrTcoin.decimals),
      cplTcoinOut: cplTcoinOut.toString(),
      cplTcoinOutFormatted: formatUnits(cplTcoinOut, runtime.cplTcoin.decimals),
      charityTopupOut: charityTopupOut.toString(),
      charityTopupOutFormatted: formatUnits(charityTopupOut, runtime.cplTcoin.decimals),
      resolvedCharityId: resolvedCharityId.toString(),
      charityWallet: getAddress(charityWallet),
    },
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
