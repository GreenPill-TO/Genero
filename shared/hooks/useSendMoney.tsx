import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const useSendMoney = ({
  senderId,
  receiverId,
}: {
  senderId: number;
  receiverId: number | null;
}) => {
  const [senderWallet, setSenderWallet] = useState<string | null>(null);
  const [receiverWallet, setReceiverWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's email and then get wallet address
  const fetchWalletAddress = async (
    userId: number,
    setWallet: (wallet: string | null) => void
  ) => {
    try {
      // Fetch email from Supabase users table
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (error) throw new Error(error.message);
      if (!data?.email) throw new Error('Email not found');

      // Lazy-load the CubidSDK
      const { CubidSDK } = await import('cubid-sdk');
      const cubidSdk = new CubidSDK(
        '58',
        '64d58b9d-e7a0-47b4-990e-a7b80c065663'
      );

      // Create or fetch user in Cubid
      const cubid_user = await cubidSdk.createUser({ email: data.email });

      // Fetch wallet address using Cubid function
      const walletAddress = await cubidSdk.fetchStamps({
        user_id: cubid_user.user_id,
      });
      if (!walletAddress)
        throw new Error('Wallet address not found');

      const evmWallet = walletAddress.all_stamps.find(
        (item: any) => item.stamptype_string === 'evm'
      )?.uniquevalue;

      setWallet(evmWallet);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fetch sender & receiver wallet addresses
  useEffect(() => {
    if (senderId) fetchWalletAddress(senderId, setSenderWallet);
    if (receiverId) fetchWalletAddress(receiverId, setReceiverWallet);
  }, [senderId, receiverId]);

  // Function to send ETH transaction
  const sendMoney = async (amount: string) => {
    if (!senderWallet || !receiverWallet) {
      setError('Wallet addresses not found');
      return;
    }
    // Add ETH sending logic here using ethers.js
  };

  return { senderWallet, receiverWallet, sendMoney, loading, error };
};
