import { createPublicClient, getAddress, http, isAddress, type Address } from "viem";
import { getRpcUrlForChainId } from "@shared/lib/contracts/cityContracts";
import { sarafuPoolAbi, sarafuTokenRegistryAbi } from "@shared/lib/sarafu/abis";

export type SarafuPoolContext = {
  poolAddress: Address;
  tokenRegistry?: Address;
  tokenLimiter?: Address;
  quoter?: Address;
  ownerAddress?: Address;
  feeAddress?: Address;
  poolName?: string;
  poolSymbol?: string;
};

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

  const [tokenRegistry, tokenLimiter, quoter, ownerAddress, feeAddress, poolName, poolSymbol] = await Promise.all([
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "tokenRegistry" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "tokenLimiter" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "quoter" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "owner" }),
    readAddressField({ client, poolAddress: options.poolAddress, functionName: "feeAddress" }),
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
    poolName,
    poolSymbol,
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
