// @ts-nocheck
import { useState, useEffect } from 'react';
import Web3 from 'web3';
import { createClient } from '@supabase/supabase-js';
import { Shamir } from '@spliterati/shamir';
import { useAuth } from '@shared/api/hooks/useAuth';
import { tokenAbi } from './abi';

// Your Supabase client initialization.
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper: convert hex string to Uint8Array
const hexToUint8Array = (hex: string): Uint8Array => {
	if (hex.startsWith('0x')) hex = hex.slice(2);
	const length = hex.length / 2;
	const uint8 = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		uint8[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return uint8;
};

// Helper: convert Uint8Array to hex string
const uint8ArrayToHex = (arr: Uint8Array): string =>
	Array.from(arr)
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('');

// Reconstruct secret using Shamir combine.
const combineShares = (shares: string[]): string => {
	try {
		const shareArrays = shares.map(share => hexToUint8Array(share));
		const secretArray = Shamir.combine(shareArrays);
		return uint8ArrayToHex(secretArray);
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
	const { userData } = useAuth();

	// Function to fetch a wallet address using Supabase and Cubid.
	const fetchWalletAddress = async (
		userId: number,
		setWallet: (wallet: string | null) => void
	) => {
		try {
			const { data, error } = await supabase
				.from('users')
				.select('email')
				.eq('id', userId)
				.single();
			if (error) throw new Error(error.message);
			if (!data?.email) throw new Error('Email not found');

			const { CubidSDK } = await import('cubid-sdk');
			const cubidSdk = new CubidSDK('58', '64d58b9d-e7a0-47b4-990e-a7b80c065663');
			const cubid_user = await cubidSdk.createUser({ email: data.email });
			const walletAddress = await cubidSdk.fetchStamps({ user_id: cubid_user.user_id });
			if (!walletAddress) throw new Error('Wallet address not found');

			const evmWallet = walletAddress.all_stamps.find(
				(item: any) => item.stamptype_string === 'evm'
			)?.uniquevalue;
			setWallet(evmWallet);
		} catch (err: any) {
			setError(err.message);
		}
	};

	useEffect(() => {
		if (senderId) fetchWalletAddress(senderId, setSenderWallet);
		if (receiverId) fetchWalletAddress(receiverId, setReceiverWallet);
	}, [senderId, receiverId]);

	/**
	 * Send a token transfer using the token contract’s transfer function.
	 *
	 * This version:
	 * 1. Retrieves the two shares from Supabase (assuming they are stored as `share1` and `share2`).
	 * 2. Reconstructs the private key.
	 * 3. Instantiates a contract instance using the provided ABI and token address.
	 * 4. Calls transfer on the contract with the receiver wallet address and token amount.
	 *
	 * @param amount - The token amount to transfer (as a string, e.g., "0.1").
	 */
	const sendMoney = async (amount: string) => {
		if (!senderWallet || !receiverWallet) {
			setError('Wallet addresses not found');
			return;
		}
		setLoading(true);
		try {
			// Fetch shares from Supabase. Here we assume your table has both `share1` and `share2` columns.
			const { data: shareData, error: shareError } = await supabase
				.from("wallet_appshare")
				.select("share1, share2")
				.match({ user_id: userData?.cubidData?.id })
				.single();
			if (shareError) throw new Error(shareError.message);
			if (!shareData?.share1 || !shareData?.share2) {
				throw new Error("Required shares not found");
			}
			const { share1, share2 } = shareData;

			// Reconstruct the private key using the two shares.
			const privateKeyHex = combineShares([share1, share2]);
			if (!privateKeyHex) {
				throw new Error('Failed to reconstruct private key from shares');
			}
			const privateKey = privateKeyHex.startsWith('0x')
				? privateKeyHex
				: '0x' + privateKeyHex;

			// Initialize Web3 using the injected provider (e.g. MetaMask)
			if (!(window as any).ethereum) {
				throw new Error('No Ethereum provider found');
			}
			const web3 = new Web3((window as any).ethereum);

			// Create an account instance from the private key and add it to the wallet.
			const account = web3.eth.accounts.privateKeyToAccount(privateKey);
			web3.eth.accounts.wallet.add(account);
			web3.eth.defaultAccount = account.address;

			// Define the token contract address (ensure it is provided in your env variables).
			const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
			if (!tokenAddress) throw new Error("Token address not provided");

			// Create a contract instance using the token ABI.
			const tokenContract = new web3.eth.Contract(tokenAbi as any, tokenAddress);

			// Parse the token amount. (Assuming token uses 18 decimals; adjust if needed.)
			const parsedAmount = web3.utils.toWei(amount, 'ether');

			// Call the transfer function.
			const tx = tokenContract.methods.transfer(receiverWallet, parsedAmount);
			const gas: string = await tx.estimateGas({ from: account.address });
			const gasPrice: string = await web3.eth.getGasPrice();

			const txReceipt = await tx
				.send({
					from: account.address,
					gas,
					gasPrice,
				})
				.once('transactionHash', (hash: string) => {
					console.log('Transaction sent, hash:', hash);
				});

			console.log('Transaction successful:', txReceipt.transactionHash);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return { senderWallet, receiverWallet, sendMoney, loading, error };
};
