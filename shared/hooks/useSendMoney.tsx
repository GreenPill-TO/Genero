import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { CubidSDK } from 'cubid-sdk';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export const useSendMoney = ({ senderId, receiverId }: { senderId: number, receiverId: number | null }) => {
    const [senderWallet, setSenderWallet] = useState<string | null>(null);
    const [receiverWallet, setReceiverWallet] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch user's email and then get wallet address
    const fetchWalletAddress = async (userId: number, setWallet: (wallet: string | null) => void) => {
        try {
            // Fetch email from Supabase users table
            const { data, error } = await supabase
                .from('users')
                .select('email')
                .eq('id', userId)
                .single();

            if (error) throw new Error(error.message);
            if (!data?.email) throw new Error('Email not found');
            const cubidsdk = new CubidSDK('58', '64d58b9d-e7a0-47b4-990e-a7b80c065663')
            // Fetch wallet address using Cubid function
            const cubid_user = await cubidsdk.createUser({ email: data.email })

            const walletAddress = await cubidsdk.fetchStamps({ user_id: cubid_user.user_id });
            if (!walletAddress) throw new Error('Wallet address not found');

            setWallet(walletAddress.all_stamps.filter((item: any) => item.stamptype_string === 'evm')[0]?.uniquevalue);
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
    };

    return { senderWallet, receiverWallet, sendMoney, loading, error };
};