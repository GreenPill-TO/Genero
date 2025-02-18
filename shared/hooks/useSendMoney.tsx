// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { Shamir } from '@spliterati/shamir';
import { useAuth } from '@shared/api/hooks/useAuth';
import { WebAuthN } from 'cubid-wallet'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper: convert hex string to Uint8Array
const hexToUint8Array = (hex: string): Uint8Array => {
    // Remove optional "0x" prefix.
    if (hex.startsWith('0x')) {
        hex = hex.slice(2);
    }
    const length = hex.length / 2;
    const uint8 = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        uint8[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return uint8;
};

// Helper: convert Uint8Array back to a hex string
const uint8ArrayToHex = (arr: Uint8Array): string => {
    return Array.from(arr)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Combine the provided hex share strings to reconstruct the private key.
 * 1. Convert each hex share back into a Uint8Array.
 * 2. Combine the shares using Shamir.combine (which returns a Uint8Array).
 * 3. Convert the resulting Uint8Array back to a hex string.
 *
 * @param shares - Array of share strings (in hex format)
 * @returns The reconstructed secret (private key) as a hex string.
 */
const combineShares = (shares: string[]): string => {
    try {
        // Convert each hex share to its Uint8Array representation
        const shareArrays = shares.map(share => hexToUint8Array(share));
        // Combine the shares; the result is a Uint8Array of the original secret bytes
        const secretArray = Shamir.combine(shareArrays);
        // Convert the combined secret back into a hex string
        const secretHex = uint8ArrayToHex(secretArray);
        return secretHex;
    } catch (error: any) {
        throw new Error('Failed to combine shares: ' + error.message);
    }
};

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
    const { userData } = useAuth()

    // Fetch user's email and then wallet address
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
            if (!walletAddress) throw new Error('Wallet address not found');

            const evmWallet = walletAddress.all_stamps.find(
                (item: any) => item.stamptype_string === 'evm'
            )?.uniquevalue;

            setWallet(evmWallet);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Fetch sender & receiver wallet addresses when IDs change
    useEffect(() => {
        if (senderId) fetchWalletAddress(senderId, setSenderWallet);
        if (receiverId) fetchWalletAddress(receiverId, setReceiverWallet);
    }, [senderId, receiverId]);

    /**
     * Function to send an ETH transaction.
     *
     * @param amount - The amount of ETH to send (e.g. '0.1')
     * @param share1 - The first user share (hex string) for the private key.
     * @param share2 - The second user share (hex string) for the private key.
     */
    const sendMoney = async (amount: string) => {
        if (!senderWallet || !receiverWallet) {
            setError('Wallet addresses not found');
            return;
        }
        setLoading(true);
        try {
            const share1 = await supabase.from("wallet_appshare").select("*").match({ user_id: userData?.cubidData?.id })
            // Reconstruct the private key by combining the two shares
            const privateKeyHex = combineShares([share1, share2]);
            if (!privateKeyHex) {
                throw new Error('Failed to reconstruct private key from shares');
            }

            // Ensure the private key has the 0x prefix required by ethers.js
            const privateKey = privateKeyHex.startsWith('0x')
                ? privateKeyHex
                : '0x' + privateKeyHex;

            // Set up a provider. If using a browser-based wallet, window.ethereum is common.
            const provider = new ethers.providers.Web3Provider(window.ethereum);

            // Create a wallet instance using the reconstructed private key
            const wallet = new ethers.Wallet(privateKey, provider);

            // Build the transaction object
            const tx = {
                to: receiverWallet,
                value: ethers.utils.parseEther(amount),
                // Optionally include additional transaction parameters (e.g. gas settings)
            };

            // Send the transaction and wait for it to be mined
            const txResponse = await wallet.sendTransaction(tx);
            await txResponse.wait();
            console.log('Transaction successful:', txResponse);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return { senderWallet, receiverWallet, sendMoney, loading, error };
};
