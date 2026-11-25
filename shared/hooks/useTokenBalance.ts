// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { tokenAbi } from "./abi";
import { getTorontoCoinWalletRuntimeOrThrow } from "@shared/lib/contracts/torontocoinRuntime";

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

      const [balanceRaw, decimalsRaw] = await Promise.all([
        client.readContract({
          address: tokenAddress as Address,
          abi: tokenAbi as any,
          functionName: "balanceOf",
          args: [normaliseWalletAddress(walletAddress)],
        }),
        client
          .readContract({
            address: tokenAddress as Address,
            abi: tokenAbi as any,
            functionName: "decimals",
            args: [],
          })
          .catch(() => tokenDecimals),
      ]);

      const formattedBalance = formatUnits(BigInt(balanceRaw), Number(decimalsRaw));

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
