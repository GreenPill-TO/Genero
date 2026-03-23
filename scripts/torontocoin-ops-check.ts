import { createPublicClient, formatUnits, getAddress, http } from "viem";

const runtime = {
  chainId: 42220,
  rpcUrl: process.env.INDEXER_CHAIN_RPC_URL?.trim() || "https://forno.celo.org",
  governance: getAddress("0x0Ae274e0898499C48832149266A6625a4D20c581"),
  treasuryController: getAddress("0x5A860da554bf1301708db7c41C4e540135e3FCE4"),
  liquidityRouter: getAddress("0x6BBa692FC6b2F7F19a925a11EEbfc4Dd67C424a7"),
  poolRegistry: getAddress("0x3e9926Ff48b84f6E625E833219353b9cfb473A74"),
  reserveRegistry: getAddress("0x2b79c161b679e9821a92a86f4f7C818BfaCb638a"),
  reserveInputRouter: getAddress("0xdCD1419C195e95dBe6BD5494597d5aF0568Ba1a3"),
  sarafuSwapPoolAdapter: getAddress("0x9EBEedA7c8a98fc58775f088A3210fAC781A1e47"),
  mentoBrokerSwapAdapter: getAddress("0x954103b12cC80599Be910f10e8A69f2909Ba013B"),
  mrTcoin: getAddress("0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3"),
  cplTcoin: getAddress("0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19"),
  bootstrapSwapPool: getAddress("0xDe2a979EC49811aD27730e451651e52b4540c594"),
  bootstrapPoolId:
    "0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000" as const,
  reserveAssetId:
    "0x5553444d00000000000000000000000000000000000000000000000000000000" as const,
  scenarioInputToken: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
  scenarioInputAmount: BigInt(1_000_000),
};

const ownableAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const liquidityRouterAbi = [
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

const reserveRegistryAbi = [
  {
    type: "function",
    name: "isReserveAssetActive",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const pointerAbi = [
  {
    type: "function",
    name: "liquidityRouter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const mentoAbi = [
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

async function readOwner(client: ReturnType<typeof createPublicClient>, address: `0x${string}`) {
  return getAddress(
    await client.readContract({
      address,
      abi: ownableAbi,
      functionName: "owner",
    })
  );
}

async function main() {
  const client = createPublicClient({
    transport: http(runtime.rpcUrl),
  });

  const [
    liquidityRouterOwner,
    treasuryControllerOwner,
    poolRegistryOwner,
    sarafuSwapPoolAdapterOwner,
    cplBalance,
    mrBalance,
    reserveAssetActive,
    reserveInputRouterPointer,
    treasuryControllerPointer,
    mentoRoute,
    preview,
  ] = await Promise.all([
    readOwner(client, runtime.liquidityRouter),
    readOwner(client, runtime.treasuryController),
    readOwner(client, runtime.poolRegistry),
    readOwner(client, runtime.sarafuSwapPoolAdapter),
    client.readContract({
      address: runtime.cplTcoin,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [runtime.bootstrapSwapPool],
    }),
    client.readContract({
      address: runtime.mrTcoin,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [runtime.bootstrapSwapPool],
    }),
    client.readContract({
      address: runtime.reserveRegistry,
      abi: reserveRegistryAbi,
      functionName: "isReserveAssetActive",
      args: [runtime.reserveAssetId],
    }),
    client.readContract({
      address: runtime.reserveInputRouter,
      abi: pointerAbi,
      functionName: "liquidityRouter",
    }),
    client.readContract({
      address: runtime.treasuryController,
      abi: pointerAbi,
      functionName: "liquidityRouter",
    }),
    client.readContract({
      address: runtime.mentoBrokerSwapAdapter,
      abi: mentoAbi,
      functionName: "getDefaultRouteConfig",
      args: [runtime.scenarioInputToken],
    }),
    client.readContract({
      address: runtime.liquidityRouter,
      abi: liquidityRouterAbi,
      functionName: "previewBuyCplTcoin",
      args: [runtime.bootstrapPoolId, runtime.governance, runtime.scenarioInputToken, runtime.scenarioInputAmount],
    }),
  ]);

  const status = {
    addresses: runtime,
    ownership: {
      liquidityRouter: {
        owner: liquidityRouterOwner,
        healthy: liquidityRouterOwner.toLowerCase() === runtime.governance.toLowerCase(),
      },
      treasuryController: {
        owner: treasuryControllerOwner,
        healthy: treasuryControllerOwner.toLowerCase() === runtime.governance.toLowerCase(),
      },
      poolRegistry: {
        owner: poolRegistryOwner,
        healthy: poolRegistryOwner.toLowerCase() === runtime.governance.toLowerCase(),
      },
      sarafuSwapPoolAdapter: {
        owner: sarafuSwapPoolAdapterOwner,
        healthy: sarafuSwapPoolAdapterOwner.toLowerCase() === runtime.governance.toLowerCase(),
      },
    },
    poolLiquidity: {
      cplTcoinFormatted: formatUnits(cplBalance, 6),
      mrTcoinFormatted: formatUnits(mrBalance, 6),
    },
    scenarioPreview: {
      selectedPoolId: preview[0],
      reserveAmountOutFormatted: formatUnits(preview[2], 18),
      mrTcoinOutFormatted: formatUnits(preview[3], 6),
      cplTcoinOutFormatted: formatUnits(preview[4], 6),
      charityTopupOutFormatted: formatUnits(preview[5], 6),
    },
    reserveRouteHealth: {
      reserveAssetActive,
      mentoUsdcRouteConfigured: mentoRoute[5],
      liquidityRouterPointerHealthy:
        getAddress(reserveInputRouterPointer).toLowerCase() === runtime.liquidityRouter.toLowerCase(),
      treasuryControllerPointerHealthy:
        getAddress(treasuryControllerPointer).toLowerCase() === runtime.liquidityRouter.toLowerCase(),
    },
  };

  const summary = [
    `TorontoCoin ops check`,
    `Chain: ${status.addresses.chainId}`,
    `Router: ${status.addresses.liquidityRouter}`,
    `Pool registry: ${status.addresses.poolRegistry}`,
    `cplTCOIN pool liquidity: ${status.poolLiquidity.cplTcoinFormatted}`,
    `mrTCOIN pool liquidity: ${status.poolLiquidity.mrTcoinFormatted}`,
    `Preview cplTCOIN out: ${status.scenarioPreview.cplTcoinOutFormatted}`,
    `Reserve route healthy: ${String(
      status.reserveRouteHealth.reserveAssetActive &&
        status.reserveRouteHealth.mentoUsdcRouteConfigured &&
        status.reserveRouteHealth.liquidityRouterPointerHealthy &&
        status.reserveRouteHealth.treasuryControllerPointerHealthy
    )}`,
  ];

  console.log(summary.join("\n"));
  console.log(
    JSON.stringify(
      status,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
