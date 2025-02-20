// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { tokenAbi } from './abi';

export const useTokenBalance = (walletAddress: string | null) => {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  console.log({ walletAddress })
  // This function fetches the balance from the token contract.
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      console.log('fetchBalance: walletAddress is null, aborting fetch.');
      return;
    }
    console.log(`fetchBalance: Starting balance fetch for walletAddress: ${walletAddress}`);
    setLoading(true);
    try {
      const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
      console.log(`fetchBalance: Retrieved token address from env: ${tokenAddress}`);
      if (!tokenAddress) {
        throw new Error("Token address not provided");
      }

      if (!window.ethereum) {
        throw new Error('No Ethereum provider found');
      }
      console.log('fetchBalance: Ethereum provider detected:', window.ethereum);

      // Initialize Web3 using the injected provider.
      const web3 = new Web3(window.ethereum);
      console.log('fetchBalance: Initialized Web3 instance:', web3);

      // Create a contract instance with the token ABI and address.
      const tokenContract = new web3.eth.Contract(tokenAbi as any, tokenAddress);
      console.log('fetchBalance: Created token contract instance:', tokenContract);

      // Call the balanceOf method.
      console.log(`fetchBalance: Calling balanceOf for walletAddress: ${walletAddress}`);
      const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
      console.log('fetchBalance: Received balance in Wei:', balanceWei);

      // Convert the balance from Wei to Ether (assumes token uses 18 decimals).
      const formattedBalance = web3.utils.fromWei(balanceWei, 'ether');
      console.log('fetchBalance: Converted balance from Wei to Ether:', formattedBalance);

      setBalance(formattedBalance);
    } catch (err: any) {
      console.error('fetchBalance: Error occurred:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.log('fetchBalance: Finished fetching balance.');
    }
  }, [walletAddress]);

  // Automatically fetch balance when walletAddress changes.
  useEffect(() => {
    console.log('useTokenBalance: walletAddress changed, triggering fetchBalance.');
    fetchBalance();
  }, [walletAddress, fetchBalance]);

  // Return the balance, loading state, error, and a manual refresh function.
  return { balance, loading, error, refreshBalance: fetchBalance };
};
