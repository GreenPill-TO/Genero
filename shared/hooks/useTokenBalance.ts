// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import { formatUnits } from "viem";
import { tokenAbi } from "./abi";
import {
  getActiveCityContracts,
  getRpcUrlForChainId,
} from "@shared/lib/contracts/cityContracts";
import {
  getTorontoCoinRuntimeConfig,
  TORONTOCOIN_RUNTIME,
} from "@shared/lib/contracts/torontocoinRuntime";

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
      let tokenAddress: string;
      let rpcUrl: string;
      let tokenDecimals = 18;

      const torontoCoinRuntime = getTorontoCoinRuntimeConfig({
        citySlug: process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin",
        chainId: TORONTOCOIN_RUNTIME.chainId,
      });

      if (torontoCoinRuntime) {
        tokenAddress = torontoCoinRuntime.cplTcoin.address;
        rpcUrl = torontoCoinRuntime.rpcUrl;
        tokenDecimals = torontoCoinRuntime.cplTcoin.decimals;
      } else {
        const activeContracts = await getActiveCityContracts();
        tokenAddress = activeContracts.contracts.TCOIN;
        rpcUrl = getRpcUrlForChainId(activeContracts.chainId);
      }

      const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));

      const tokenContract = new web3.eth.Contract(tokenAbi as any, tokenAddress);

      const balanceRaw = await tokenContract.methods.balanceOf(walletAddress).call();
      const decimalsRaw = tokenContract.methods.decimals
        ? await tokenContract.methods.decimals().call().catch(() => String(tokenDecimals))
        : String(tokenDecimals);
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
