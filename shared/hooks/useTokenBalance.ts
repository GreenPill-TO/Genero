// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import { tokenAbi } from "./abi";
import {
  getActiveCityContracts,
  getRpcUrlForChainId,
} from "@shared/lib/contracts/cityContracts";

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
      const activeContracts = await getActiveCityContracts();
      const tokenAddress = activeContracts.contracts.TCOIN;
      const rpcUrl = getRpcUrlForChainId(activeContracts.chainId);

      const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));

      const tokenContract = new web3.eth.Contract(tokenAbi as any, tokenAddress);

      const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
      const formattedBalance = web3.utils.fromWei(balanceWei, "ether");

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
