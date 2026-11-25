// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { tokenAbi } from "./abi";
import {
  assertTorontoCoinWalletTokenIdentity,
  getTorontoCoinWalletRuntimeOrThrow,
} from "@shared/lib/contracts/torontocoinRuntime";

const publicClientCache = new Map<string, ReturnType<typeof createPublicClient>>();

function getCachedPublicClient(chainId: number, rpcUrl: string) {
  const cacheKey = `${chainId}:${rpcUrl}`;
  const cached = publicClientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createPublicClient({
    transport: http(rpcUrl),
  });
  publicClientCache.set(cacheKey, client);
  return client;
}

function normaliseWalletAddress(value: string): Address {
  return value as Address;
}

export const useTokenBalance = (walletAddress: string | null) => {
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const runtime = getTorontoCoinWalletRuntimeOrThrow();
      const tokenAddress = runtime.cplTcoin.address;
      const rpcUrl = runtime.rpcUrl;
      const chainId = runtime.chainId;
      const tokenDecimals = runtime.cplTcoin.decimals;

      const client = getCachedPublicClient(chainId, rpcUrl);

      const [actualChainId, bytecode, name, symbol, decimalsRaw] = await Promise.all([
        client.getChainId(),
        client.getBytecode({ address: tokenAddress }),
        client.readContract({
          address: tokenAddress as Address,
          abi: tokenAbi as any,
          functionName: "name",
          args: [],
        }),
        client.readContract({
          address: tokenAddress as Address,
          abi: tokenAbi as any,
          functionName: "symbol",
          args: [],
        }),
        client.readContract({
          address: tokenAddress as Address,
          abi: tokenAbi as any,
          functionName: "decimals",
          args: [],
        }),
      ]);
      assertTorontoCoinWalletTokenIdentity({
        runtime,
        actualChainId,
        bytecode,
        name: String(name),
        symbol: String(symbol),
        decimals: Number(decimalsRaw),
      });

      const balanceRaw = await client.readContract({
        address: tokenAddress as Address,
        abi: tokenAbi as any,
        functionName: "balanceOf",
        args: [normaliseWalletAddress(walletAddress)],
      });

      const formattedBalance = formatUnits(BigInt(balanceRaw), tokenDecimals);

      setBalance(formattedBalance);
    } catch (err: any) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to fetch token balance.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refreshBalance: fetchBalance };
};
