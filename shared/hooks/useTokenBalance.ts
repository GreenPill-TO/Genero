// @ts-nocheck

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Define the relevant portion of your token ABI.
const tokenAbi = [
  // ... other ABI definitions if needed ...
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // ... rest of ABI if needed ...
];

export const useTokenBalance = (walletAddress: string | null) => {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // This function fetches the balance from the token contract.
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
      if (!tokenAddress) throw new Error("Token address not provided");

      // Create an ethers provider (assumes window.ethereum is available)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      // Create a read-only contract instance
      const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);

      // Call balanceOf to get the balance (as a BigNumber)
      const balanceBigNumber = await tokenContract.balanceOf(walletAddress);
      // Format the balance assuming 18 decimals (adjust if necessary)
      const formattedBalance = ethers.utils.formatEther(balanceBigNumber);
      setBalance(formattedBalance);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Automatically fetch balance when walletAddress changes.
  useEffect(() => {
    fetchBalance();
  }, [walletAddress, fetchBalance]);

  // Return the balance, loading state, error, and a manual refresh function.
  return { balance, loading, error, refreshBalance: fetchBalance };
};
