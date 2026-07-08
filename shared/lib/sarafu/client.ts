import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { getRpcUrlForChainId } from "@shared/lib/contracts/cityContracts";
import { sarafuPoolAbi, sarafuQuoterAbi, sarafuTokenRegistryAbi } from "@shared/lib/sarafu/abis";

export type SarafuPoolContext = {
  poolAddress: Address;
  tokenRegistry?: Address;
  tokenLimiter?: Address;
  quoter?: Address;
  ownerAddress?: Address;
  feeAddress?: Address;
  feePpm?: bigint;
  poolName?: string;
  poolSymbol?: string;
};

export type SarafuQuoteSource = "pool_getQuote" | "quoter_valueFor";

export type SarafuQuoteResult = {
  quoteSource: SarafuQuoteSource;
  expectedOut: bigint;
  feePpm: bigint | null;
};

const FEE_DENOMINATOR_PPM = BigInt(1_000_000);

function applyFeePpm(rawAmountOut: bigint, feePpm: bigint | null): bigint {
  if (feePpm == null || feePpm <= BigInt(0)) {
    return rawAmountOut;
  }
  if (feePpm >= FEE_DENOMINATOR_PPM) {
    return BigInt(0);
  }
  const fee = (rawAmountOut * feePpm) / FEE_DENOMINATOR_PPM;
  return rawAmountOut - fee;
}

function toAddress(value: unknown): Address | undefined {
  if (typeof value !== "string" || !isAddress(value)) {
    return undefined;
  }

  const checksummed = getAddress(value);
  if (checksummed.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return undefined;
  }

  return checksummed;
}

export function createSarafuPublicClient(chainId: number, rpcUrl?: string) {
  return createPublicClient({
    transport: http(rpcUrl ?? getRpcUrlForChainId(chainId)),
  });
}

async function readAddressField(options: {
  client: ReturnType<typeof createSarafuPublicClient>;
  poolAddress: Address;
  functionName: "tokenRegistry" | "tokenLimiter" | "quoter" | "owner" | "feeAddress";
}) {
  try {
    const value = await options.client.readContract({
      address: options.poolAddress,
      abi: sarafuPoolAbi,
      functionName: options.functionName,
    });

    return toAddress(value);
  } catch {
    return undefined;
  }
}

async function readUintField(options: {
  client: ReturnType<typeof createSarafuPublicClient>;
  poolAddress: Address;
  functionName: "feePpm";
}) {
  try {
    const value = await options.client.readContract({
      address: options.poolAddress,
      abi: sarafuPoolAbi,
      functionName: options.functionName,
    });

    return typeof value === "bigint" ? value : null;
  } catch {
    return null;
  }
}

async function readStringField(options: {
  client: ReturnType<typeof createSarafuPublicClient>;
  poolAddress: Address;
  functionName: "name" | "symbol";
}) {
  try {
    const value = await options.client.readContract({
      address: options.poolAddress,
      abi: sarafuPoolAbi,
      functionName: options.functionName,
    });

    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function readSarafuPoolContext(options: {
  chainId: number;
  poolAddress: Address;
  rpcUrl?: string;
}): Promise<SarafuPoolContext> {
  const client = createSarafuPublicClient(options.chainId, options.rpcUrl);

  const [tokenRegistry, tokenLimiter, quoter, ownerAddress, feeAddress, feePpm, poolName, poolSymbol] =
    await Promise.all([
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "tokenRegistry" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "tokenLimiter" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "quoter" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "owner" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "feeAddress" }),
    readUintField({ client, poolAddress: options.poolAddress, functionName: "feePpm" }),
    readStringField({ client, poolAddress: options.poolAddress, functionName: "name" }),
    readStringField({ client, poolAddress: options.poolAddress, functionName: "symbol" }),
    ]);

  return {
    poolAddress: options.poolAddress,
    tokenRegistry,
    tokenLimiter,
    quoter,
    ownerAddress,
    feeAddress,
    feePpm: feePpm ?? undefined,
    poolName,
    poolSymbol,
  };
}

async function callSingleUintResult(options: {
  client: ReturnType<typeof createSarafuPublicClient>;
  target: Address;
  data: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
}): Promise<bigint | null> {
  try {
    const callResult = await options.client.call({
      to: options.target,
      data: options.data,
    });
    if (!callResult.data) {
      return null;
    }
    const decoded = decodeFunctionResult({
      abi: options.abi as any,
      functionName: options.functionName as any,
      data: callResult.data,
    }) as unknown;
    if (typeof decoded === "bigint") {
      return decoded;
    }
    if (Array.isArray(decoded)) {
      const firstBigint = decoded.find((part) => typeof part === "bigint");
      if (typeof firstBigint === "bigint") {
        return firstBigint;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function quoteSarafuPoolSwap(options: {
  chainId: number;
  poolAddress: Address;
  quoterAddress?: Address;
  tokenOut: Address;
  tokenIn: Address;
  amountIn: bigint;
  rpcUrl?: string;
}): Promise<SarafuQuoteResult | null> {
  const client = createSarafuPublicClient(options.chainId, options.rpcUrl);

  const feePpm = await readUintField({
    client,
    poolAddress: options.poolAddress,
    functionName: "feePpm",
  });

  const getQuoteData = encodeFunctionData({
    abi: sarafuPoolAbi,
    functionName: "getQuote",
    args: [options.tokenOut, options.tokenIn, options.amountIn],
  });

  const poolQuote = await callSingleUintResult({
    client,
    target: options.poolAddress,
    data: getQuoteData,
    abi: sarafuPoolAbi,
    functionName: "getQuote",
  });

  if (poolQuote != null) {
    return {
      quoteSource: "pool_getQuote",
      expectedOut: applyFeePpm(poolQuote, feePpm),
      feePpm,
    };
  }

  if (!options.quoterAddress) {
    return null;
  }

  const valueForData = encodeFunctionData({
    abi: sarafuQuoterAbi,
    functionName: "valueFor",
    args: [options.tokenOut, options.tokenIn, options.amountIn],
  });

  const quoterQuote = await callSingleUintResult({
    client,
    target: options.quoterAddress,
    data: valueForData,
    abi: sarafuQuoterAbi,
    functionName: "valueFor",
  });

  if (quoterQuote == null) {
    return null;
  }

  return {
    quoteSource: "quoter_valueFor",
    expectedOut: applyFeePpm(quoterQuote, feePpm),
    feePpm,
  };
}

async function readRegistryEntry(options: {
  client: ReturnType<typeof createSarafuPublicClient>;
  tokenRegistry: Address;
  index: number;
}): Promise<Address | undefined> {
  for (const functionName of ["entry", "entries"] as const) {
    try {
      const value = await options.client.readContract({
        address: options.tokenRegistry,
        abi: sarafuTokenRegistryAbi,
        functionName,
        args: [BigInt(options.index)],
      });

      const direct = toAddress(value);
      if (direct) {
        return direct;
      }

      if (Array.isArray(value)) {
        const nested = value.find((part) => typeof part === "string" && isAddress(part));
        if (typeof nested === "string") {
          return getAddress(nested);
        }
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

export async function listPoolTokens(options: {
  chainId: number;
  tokenRegistry: Address;
  rpcUrl?: string;
}): Promise<Address[]> {
  const client = createSarafuPublicClient(options.chainId, options.rpcUrl);

  let entryCount = 0;
  try {
    const value = await client.readContract({
      address: options.tokenRegistry,
      abi: sarafuTokenRegistryAbi,
      functionName: "entryCount",
    });
    entryCount = Number(value);
  } catch {
    entryCount = 0;
  }

  if (entryCount <= 0) {
    return [];
  }

  const tokens: Address[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const token = await readRegistryEntry({
      client,
      tokenRegistry: options.tokenRegistry,
      index,
    });
    if (token) {
      tokens.push(token);
    }
  }

  return Array.from(new Set(tokens.map((token) => getAddress(token))));
}

export async function isTokenInSarafuPool(options: {
  chainId: number;
  poolAddress: Address;
  tokenAddress: Address;
  rpcUrl?: string;
}): Promise<boolean> {
  const context = await readSarafuPoolContext({
    chainId: options.chainId,
    poolAddress: options.poolAddress,
    rpcUrl: options.rpcUrl,
  });

  if (!context.tokenRegistry) {
    return false;
  }

  const tokens = await listPoolTokens({
    chainId: options.chainId,
    tokenRegistry: context.tokenRegistry,
    rpcUrl: options.rpcUrl,
  });

  const needle = getAddress(options.tokenAddress).toLowerCase();
  return tokens.some((token) => token.toLowerCase() === needle);
}
