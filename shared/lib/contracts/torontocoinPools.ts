import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  getConfiguredTorontoCoinTrackedPools,
  getTorontoCoinRpcUrl,
  TORONTOCOIN_RUNTIME,
  type TorontoCoinRuntimeConfig,
  type TrackedTorontoCoinPool,
} from "./torontocoinRuntime";

const poolRegistryAbi = [
  {
    type: "function",
    name: "listPoolIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "poolId", type: "bytes32" },
          { name: "poolAddress", type: "address" },
          { name: "name", type: "string" },
          { name: "metadataRecordId", type: "string" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getPoolAddress",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getPoolIdByAddress",
    stateMutability: "view",
    inputs: [{ name: "poolAddress", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "isRegisteredPoolAddress",
    stateMutability: "view",
    inputs: [{ name: "poolAddress", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isPoolActive",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const poolAbi = [
  {
    type: "function",
    name: "tokenRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenLimiter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "quoter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "feeAddress",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "feePpm",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getQuote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_outToken", type: "address" },
      { name: "_inToken", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

const tokenRegistryAbi = [
  {
    type: "function",
    name: "entryCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "entry",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "entries",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

const limiterAbi = [
  {
    type: "function",
    name: "limitOf",
    stateMutability: "view",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_holder", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const quoterAbi = [
  {
    type: "function",
    name: "priceIndex",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const erc20MetadataAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const liquidityRouterReadAbi = [
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type PoolRecord = {
  poolId: Hex;
  poolAddress: Address;
  name: string;
  metadataRecordId: string;
  status: number;
  createdAt: bigint;
  updatedAt: bigint;
};

export type TorontoCoinTrackedPoolTokenStatus = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  limitRaw: string | null;
  limitFormatted: string | null;
  priceIndexRaw: string | null;
};

export type TorontoCoinTrackedPoolQuoteCheck = {
  label: string;
  inputToken: Address;
  outputToken: Address;
  inputAmountRaw: string;
  inputAmountFormatted: string;
  outputAmountRaw: string | null;
  outputAmountFormatted: string | null;
  healthy: boolean;
  error: string | null;
};

export type TorontoCoinTrackedPoolPreviewStatus = {
  healthy: boolean;
  error: string | null;
  selectedPoolId: Hex | null;
  reserveAssetId: Hex | null;
  reserveAmountOut: string | null;
  reserveAmountOutFormatted: string | null;
  mrTcoinOut: string | null;
  mrTcoinOutFormatted: string | null;
  cplTcoinOut: string | null;
  cplTcoinOutFormatted: string | null;
  charityTopupOut: string | null;
  charityTopupOutFormatted: string | null;
};

export type TorontoCoinTrackedPoolStatus = {
  poolId: Hex;
  poolAddress: Address;
  name: string;
  tokens: Address[];
  expectedIndexerVisibility: boolean;
  previewEnabled: boolean;
  acceptanceEnabled: boolean;
  registration: {
    resolvedPoolId: Hex | null;
    registryAddressMatches: boolean;
    active: boolean;
    feeBypassEligible: boolean;
  };
  components: {
    tokenRegistry: Address | null;
    tokenLimiter: Address | null;
    quoter: Address | null;
    feeAddress: Address | null;
    owner: Address | null;
    feePpm: string | null;
  };
  tokensStatus: TorontoCoinTrackedPoolTokenStatus[];
  limiter: {
    configured: boolean;
    healthy: boolean;
  };
  quoteChecks: TorontoCoinTrackedPoolQuoteCheck[];
  scenarioPreview: TorontoCoinTrackedPoolPreviewStatus | null;
};

function toAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return null;
  }

  const checksummed = getAddress(trimmed);
  return checksummed.toLowerCase() === ZERO_ADDRESS ? null : checksummed;
}

function dedupeAddresses(addresses: Address[]): Address[] {
  const seen = new Set<string>();
  const output: Address[] = [];

  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (!seen.has(normalized)) {
      output.push(getAddress(address));
      seen.add(normalized);
    }
  }

  return output;
}

function pow10(decimals: number): bigint {
  return BigInt(10) ** BigInt(Math.max(0, decimals));
}

async function safeReadAddress(
  client: PublicClient,
  contractAddress: Address,
  functionName: "tokenRegistry" | "tokenLimiter" | "quoter" | "owner" | "feeAddress"
): Promise<Address | null> {
  try {
    const value = await client.readContract({
      address: contractAddress,
      abi: poolAbi,
      functionName,
    });
    return toAddress(value);
  } catch {
    return null;
  }
}

async function safeReadString(
  client: PublicClient,
  contractAddress: Address,
  functionName: "name" | "symbol"
): Promise<string | null> {
  try {
    const value = await client.readContract({
      address: contractAddress,
      abi: poolAbi,
      functionName,
    });
    return typeof value === "string" && value.trim() !== "" ? value : null;
  } catch {
    return null;
  }
}

async function safeReadTokenMetadata(
  client: PublicClient,
  tokenAddress: Address
): Promise<{ name: string; symbol: string; decimals: number }> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20MetadataAbi,
        functionName: "name",
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20MetadataAbi,
        functionName: "symbol",
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20MetadataAbi,
        functionName: "decimals",
      }),
    ]);

    return {
      name: typeof name === "string" && name.trim() !== "" ? name : tokenAddress,
      symbol: typeof symbol === "string" && symbol.trim() !== "" ? symbol : tokenAddress.slice(0, 8),
      decimals: Number(decimals),
    };
  } catch {
    return {
      name: tokenAddress,
      symbol: tokenAddress.slice(0, 8),
      decimals: 18,
    };
  }
}

async function safeReadBalance(
  client: PublicClient,
  tokenAddress: Address,
  holder: Address
): Promise<bigint> {
  try {
    return await client.readContract({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "balanceOf",
      args: [holder],
    });
  } catch {
    return BigInt(0);
  }
}

async function readAddressEntry(
  client: PublicClient,
  registryAddress: Address,
  index: number
): Promise<Address | null> {
  for (const functionName of ["entry", "entries"] as const) {
    try {
      const value = await client.readContract({
        address: registryAddress,
        abi: tokenRegistryAbi,
        functionName,
        args: [BigInt(index)],
      });
      return toAddress(value);
    } catch {
      continue;
    }
  }

  return null;
}

async function readTokenRegistryEntries(
  client: PublicClient,
  registryAddress: Address | null
): Promise<Address[]> {
  if (!registryAddress) {
    return [];
  }

  try {
    const entryCount = Number(
      await client.readContract({
        address: registryAddress,
        abi: tokenRegistryAbi,
        functionName: "entryCount",
      })
    );

    const entries: Address[] = [];
    for (let index = 0; index < entryCount; index += 1) {
      const tokenAddress = await readAddressEntry(client, registryAddress, index);
      if (tokenAddress) {
        entries.push(tokenAddress);
      }
    }
    return dedupeAddresses(entries);
  } catch {
    return [];
  }
}

async function readRegisteredPoolRecords(
  client: PublicClient,
  runtime: TorontoCoinRuntimeConfig
): Promise<TrackedTorontoCoinPool[]> {
  let poolIds: readonly Hex[] = [];
  try {
    poolIds = await client.readContract({
      address: runtime.poolRegistry,
      abi: poolRegistryAbi,
      functionName: "listPoolIds",
    });
  } catch {
    poolIds = [];
  }

  const registered = await Promise.all(
    poolIds.map(async (poolId) => {
      try {
        const pool = (await client.readContract({
          address: runtime.poolRegistry,
          abi: poolRegistryAbi,
          functionName: "getPool",
          args: [poolId],
        })) as PoolRecord;

        const poolAddress = toAddress(pool.poolAddress);
        if (!poolAddress) {
          return null;
        }

        return {
          poolId,
          poolAddress,
          name:
            typeof pool.name === "string" && pool.name.trim() !== "" ? pool.name : `Pool ${poolId.slice(0, 10)}`,
          tokens: [runtime.mrTcoin.address, runtime.cplTcoin.address],
          expectedIndexerVisibility: true,
          previewEnabled: true,
          acceptanceEnabled: poolId.toLowerCase() === runtime.bootstrapPoolId.toLowerCase(),
        } satisfies TrackedTorontoCoinPool;
      } catch {
        return null;
      }
    })
  );

  return registered.filter((value): value is TrackedTorontoCoinPool => value !== null);
}

function mergeTrackedPools(
  configured: readonly TrackedTorontoCoinPool[],
  discovered: readonly TrackedTorontoCoinPool[]
): TrackedTorontoCoinPool[] {
  const merged = new Map<string, TrackedTorontoCoinPool>();

  for (const pool of [...configured, ...discovered]) {
    const key = `${pool.poolId.toLowerCase()}:${pool.poolAddress.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, pool);
      continue;
    }

    merged.set(key, {
      ...existing,
      ...pool,
      tokens: dedupeAddresses([...existing.tokens, ...pool.tokens]),
      expectedIndexerVisibility: existing.expectedIndexerVisibility || pool.expectedIndexerVisibility,
      previewEnabled: existing.previewEnabled || pool.previewEnabled,
      acceptanceEnabled: existing.acceptanceEnabled || pool.acceptanceEnabled,
    });
  }

  return Array.from(merged.values());
}

function shouldAddQuoteForToken(tokenAddress: Address, runtime: TorontoCoinRuntimeConfig): boolean {
  const lower = tokenAddress.toLowerCase();
  return (
    lower !== runtime.mrTcoin.address.toLowerCase() && lower !== runtime.cplTcoin.address.toLowerCase()
  );
}

async function safeReadLimit(
  client: PublicClient,
  limiterAddress: Address | null,
  tokenAddress: Address,
  poolAddress: Address
): Promise<bigint | null> {
  if (!limiterAddress) {
    return null;
  }

  try {
    return await client.readContract({
      address: limiterAddress,
      abi: limiterAbi,
      functionName: "limitOf",
      args: [tokenAddress, poolAddress],
    });
  } catch {
    return null;
  }
}

async function safeReadPriceIndex(
  client: PublicClient,
  quoterAddress: Address | null,
  tokenAddress: Address
): Promise<bigint | null> {
  if (!quoterAddress) {
    return null;
  }

  try {
    return await client.readContract({
      address: quoterAddress,
      abi: quoterAbi,
      functionName: "priceIndex",
      args: [tokenAddress],
    });
  } catch {
    return null;
  }
}

async function safeReadQuote(options: {
  client: PublicClient;
  poolAddress: Address;
  outputToken: Address;
  inputToken: Address;
  inputAmount: bigint;
  inputDecimals: number;
  outputDecimals: number;
  label: string;
}): Promise<TorontoCoinTrackedPoolQuoteCheck> {
  try {
    const outputAmount = await options.client.readContract({
      address: options.poolAddress,
      abi: poolAbi,
      functionName: "getQuote",
      args: [options.outputToken, options.inputToken, options.inputAmount],
    });

    return {
      label: options.label,
      inputToken: options.inputToken,
      outputToken: options.outputToken,
      inputAmountRaw: options.inputAmount.toString(),
      inputAmountFormatted: formatUnits(options.inputAmount, options.inputDecimals),
      outputAmountRaw: outputAmount.toString(),
      outputAmountFormatted: formatUnits(outputAmount, options.outputDecimals),
      healthy: outputAmount > BigInt(0),
      error: null,
    };
  } catch (error) {
    return {
      label: options.label,
      inputToken: options.inputToken,
      outputToken: options.outputToken,
      inputAmountRaw: options.inputAmount.toString(),
      inputAmountFormatted: formatUnits(options.inputAmount, options.inputDecimals),
      outputAmountRaw: null,
      outputAmountFormatted: null,
      healthy: false,
      error: error instanceof Error ? error.message : "Quote failed",
    };
  }
}

async function readScenarioPreview(
  client: PublicClient,
  runtime: TorontoCoinRuntimeConfig,
  poolId: Hex,
  previewEnabled: boolean
): Promise<TorontoCoinTrackedPoolPreviewStatus | null> {
  if (!previewEnabled) {
    return null;
  }

  try {
    const preview = await client.readContract({
      address: runtime.liquidityRouter,
      abi: liquidityRouterReadAbi,
      functionName: "previewBuyCplTcoin",
      args: [poolId, runtime.governance, runtime.scenarioInputToken, runtime.scenarioInputAmount],
    });

    return {
      healthy: true,
      error: null,
      selectedPoolId: preview[0],
      reserveAssetId: preview[1],
      reserveAmountOut: preview[2].toString(),
      reserveAmountOutFormatted: formatUnits(preview[2], 18),
      mrTcoinOut: preview[3].toString(),
      mrTcoinOutFormatted: formatUnits(preview[3], runtime.mrTcoin.decimals),
      cplTcoinOut: preview[4].toString(),
      cplTcoinOutFormatted: formatUnits(preview[4], runtime.cplTcoin.decimals),
      charityTopupOut: preview[5].toString(),
      charityTopupOutFormatted: formatUnits(preview[5], runtime.cplTcoin.decimals),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Preview failed",
      selectedPoolId: null,
      reserveAssetId: null,
      reserveAmountOut: null,
      reserveAmountOutFormatted: null,
      mrTcoinOut: null,
      mrTcoinOutFormatted: null,
      cplTcoinOut: null,
      cplTcoinOutFormatted: null,
      charityTopupOut: null,
      charityTopupOutFormatted: null,
    };
  }
}

export function createTorontoCoinPublicClient(
  runtime: TorontoCoinRuntimeConfig = TORONTOCOIN_RUNTIME
): PublicClient {
  return createPublicClient({
    transport: http(getTorontoCoinRpcUrl()),
  });
}

export async function listTorontoCoinTrackedPools(options?: {
  client?: PublicClient;
  runtime?: TorontoCoinRuntimeConfig;
}): Promise<TrackedTorontoCoinPool[]> {
  const runtime = options?.runtime ?? TORONTOCOIN_RUNTIME;
  const client = options?.client ?? createTorontoCoinPublicClient(runtime);
  const configured = getConfiguredTorontoCoinTrackedPools({
    citySlug: runtime.citySlug,
    chainId: runtime.chainId,
  });
  const discovered = await readRegisteredPoolRecords(client, runtime);
  return mergeTrackedPools(configured, discovered);
}

export async function getTorontoCoinTrackedPoolStatuses(options?: {
  client?: PublicClient;
  runtime?: TorontoCoinRuntimeConfig;
}): Promise<TorontoCoinTrackedPoolStatus[]> {
  const runtime = options?.runtime ?? TORONTOCOIN_RUNTIME;
  const client = options?.client ?? createTorontoCoinPublicClient(runtime);
  const pools = await listTorontoCoinTrackedPools({ client, runtime });

  return Promise.all(
    pools.map(async (pool) => {
      const [resolvedPoolId, feeBypassEligible, active] = await Promise.all([
        client.readContract({
          address: runtime.poolRegistry,
          abi: poolRegistryAbi,
          functionName: "getPoolIdByAddress",
          args: [pool.poolAddress],
        }),
        client.readContract({
          address: runtime.poolRegistry,
          abi: poolRegistryAbi,
          functionName: "isRegisteredPoolAddress",
          args: [pool.poolAddress],
        }),
        client.readContract({
          address: runtime.poolRegistry,
          abi: poolRegistryAbi,
          functionName: "isPoolActive",
          args: [pool.poolId],
        }),
      ]);

      const tokenRegistry = await safeReadAddress(client, pool.poolAddress, "tokenRegistry");
      const tokenLimiter = await safeReadAddress(client, pool.poolAddress, "tokenLimiter");
      const quoter = await safeReadAddress(client, pool.poolAddress, "quoter");
      const feeAddress = await safeReadAddress(client, pool.poolAddress, "feeAddress");
      const owner = await safeReadAddress(client, pool.poolAddress, "owner");
      const poolName =
        (await safeReadString(client, pool.poolAddress, "name")) ??
        pool.name;
      const feePpm = await (async () => {
        try {
          const value = await client.readContract({
            address: pool.poolAddress,
            abi: poolAbi,
            functionName: "feePpm",
          });
          return value.toString();
        } catch {
          return null;
        }
      })();

      const discoveredTokens = await readTokenRegistryEntries(client, tokenRegistry);
      const tokenAddresses = dedupeAddresses([
        runtime.mrTcoin.address,
        runtime.cplTcoin.address,
        ...pool.tokens,
        ...discoveredTokens,
      ]);

      const tokensStatus = await Promise.all(
        tokenAddresses.map(async (tokenAddress) => {
          const metadata = await safeReadTokenMetadata(client, tokenAddress);
          const [balance, limit, priceIndex] = await Promise.all([
            safeReadBalance(client, tokenAddress, pool.poolAddress),
            safeReadLimit(client, tokenLimiter, tokenAddress, pool.poolAddress),
            safeReadPriceIndex(client, quoter, tokenAddress),
          ]);

          return {
            address: tokenAddress,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            balanceRaw: balance.toString(),
            balanceFormatted: formatUnits(balance, metadata.decimals),
            limitRaw: limit?.toString() ?? null,
            limitFormatted: limit != null ? formatUnits(limit, metadata.decimals) : null,
            priceIndexRaw: priceIndex?.toString() ?? null,
          } satisfies TorontoCoinTrackedPoolTokenStatus;
        })
      );

      const tokenByAddress = new Map(tokensStatus.map((token) => [token.address.toLowerCase(), token]));
      const mrToken = tokenByAddress.get(runtime.mrTcoin.address.toLowerCase());
      const cplToken = tokenByAddress.get(runtime.cplTcoin.address.toLowerCase());

      const quoteChecks: TorontoCoinTrackedPoolQuoteCheck[] = [];
      if (mrToken && cplToken) {
        quoteChecks.push(
          await safeReadQuote({
            client,
            poolAddress: pool.poolAddress,
            outputToken: cplToken.address,
            inputToken: mrToken.address,
            inputAmount: pow10(mrToken.decimals),
            inputDecimals: mrToken.decimals,
            outputDecimals: cplToken.decimals,
            label: "mrTCOIN -> cplTCOIN",
          }),
          await safeReadQuote({
            client,
            poolAddress: pool.poolAddress,
            outputToken: mrToken.address,
            inputToken: cplToken.address,
            inputAmount: pow10(cplToken.decimals),
            inputDecimals: cplToken.decimals,
            outputDecimals: mrToken.decimals,
            label: "cplTCOIN -> mrTCOIN",
          })
        );
      }

      for (const token of tokensStatus) {
        if (!shouldAddQuoteForToken(token.address, runtime) || !cplToken) {
          continue;
        }

        quoteChecks.push(
          await safeReadQuote({
            client,
            poolAddress: pool.poolAddress,
            outputToken: cplToken.address,
            inputToken: token.address,
            inputAmount: pow10(token.decimals),
            inputDecimals: token.decimals,
            outputDecimals: cplToken.decimals,
            label: `${token.symbol} -> cplTCOIN`,
          }),
          await safeReadQuote({
            client,
            poolAddress: pool.poolAddress,
            outputToken: token.address,
            inputToken: cplToken.address,
            inputAmount: pow10(cplToken.decimals),
            inputDecimals: cplToken.decimals,
            outputDecimals: token.decimals,
            label: `cplTCOIN -> ${token.symbol}`,
          })
        );
      }

      const limiterHealthy =
        tokenLimiter == null ||
        tokensStatus.every((token) => token.limitRaw == null || BigInt(token.limitRaw) >= BigInt(token.balanceRaw));

      return {
        poolId: pool.poolId,
        poolAddress: pool.poolAddress,
        name: poolName,
        tokens: tokenAddresses,
        expectedIndexerVisibility: pool.expectedIndexerVisibility,
        previewEnabled: pool.previewEnabled,
        acceptanceEnabled: pool.acceptanceEnabled,
        registration: {
          resolvedPoolId: resolvedPoolId === "0x0000000000000000000000000000000000000000000000000000000000000000"
            ? null
            : resolvedPoolId,
          registryAddressMatches: resolvedPoolId.toLowerCase() === pool.poolId.toLowerCase(),
          active,
          feeBypassEligible,
        },
        components: {
          tokenRegistry,
          tokenLimiter,
          quoter,
          feeAddress,
          owner,
          feePpm,
        },
        tokensStatus,
        limiter: {
          configured: tokenLimiter != null,
          healthy: limiterHealthy,
        },
        quoteChecks,
        scenarioPreview: await readScenarioPreview(client, runtime, pool.poolId, pool.previewEnabled),
      } satisfies TorontoCoinTrackedPoolStatus;
    })
  );
}
