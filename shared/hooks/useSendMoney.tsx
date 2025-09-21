// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { createClient } from '@shared/lib/supabase/client';
import { Shamir } from '@spliterati/shamir';
import { useAuth } from '@shared/api/hooks/useAuth';
import { tokenAbi } from './abi';
import { WebAuthnCrypto } from 'cubid-wallet';
import { transfer } from '@shared/utils/insertNotification';
import { normaliseTransferResult, TransferRecordSnapshot } from '@shared/utils/transferRecord';
import { useControlVariables } from '@shared/hooks/useGetLatestExchangeRate';


// Helper: Convert hex string to Uint8Array.
const hexToUint8Array = (hex: string): Uint8Array => {
	if (hex.startsWith('0x')) hex = hex.slice(2);
	const length = hex.length / 2;
	const uint8 = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		uint8[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return uint8;
};

// Helper: Convert Uint8Array to hex string.
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

const webAuthn = new WebAuthnCrypto();

// Helper: Convert base64 string to ArrayBuffer.
function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const length = binaryString.length;
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

// Helper: Extract a decimal number from a string.
function extractDecimalFromString(str: string): number {
	const match = str.match(/-?\d+(\.\d+)?/);
	return match ? Number(match[0]) : NaN;
}

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
        const lastTransferRecordRef = useRef<TransferRecordSnapshot | null>(null);
        const { userData } = useAuth();

	// Fetch wallet address from Supabase using Cubid.
        const fetchWalletAddress = async (
                userId: number | null | undefined,
                setWallet: (wallet: string | null) => void
        ) => {
                if (!userId) return;
                const supabase = createClient();
                try {
                        const { data, error } = await supabase
                                .from('users')
                                .select('email')
                                .eq('id', userId)
                                .single();
                        if (error) throw new Error(error.message);
                        if (!data?.email) throw new Error('Email not found');
                        const { data: wallet_data, error: walletErr } = await supabase
                                .from("wallet_list")
                                .select("*")
                                .match({ user_id: userId });
                        if (walletErr) throw new Error(walletErr.message);
                        setWallet(wallet_data?.[0]?.public_key ?? null);
                } catch (err: any) {
                        console.error('fetchWalletAddress error', err);
                        setError(err.message);
                }
        };

	useEffect(() => {
		console.log({ receiverId })
		if (senderId) fetchWalletAddress(senderId, setSenderWallet);
		if (receiverId) fetchWalletAddress(receiverId, setReceiverWallet);
	}, [senderId, receiverId]);


	const burnMoney = async (amount: string) => {
                const supabase = createClient();
		if (!senderWallet) {
			setError('Wallet addresses not found');
			return;
		}

		// Ensure we have a valid user ID in userData.
		const cubidUserId = userData?.cubidData?.id;
		if (!cubidUserId) {
			setError('No valid Cubid user ID found');
			return;
		}
		setLoading(true);
		setError(null);

		try {
			// Fetch shares from Supabase.
			const { data: shareData, error: shareError } = await supabase
				.from('wallet_list')
				.select('app_share')
				.match({ user_id: cubidUserId })
				.single();

			if (shareError) throw new Error(shareError.message);
			if (!shareData?.app_share) {
				throw new Error('No app_share found for this user');
			}

			const { data: userShare, error: userShareError } = await supabase
				.from('user_encrypted_share')
				.select('user_share_encrypted')
				.match({ user_id: cubidUserId })
				.single();

			if (userShareError) throw new Error(userShareError.message);
			if (!userShare?.user_share_encrypted) {
				throw new Error('No user_share_encrypted found for this user');
			}

			const { app_share } = shareData;
			const { user_share_encrypted } = userShare;

			// Prepare the data for decryption.
			const jsonData = {
				encryptedAesKey: base64ToArrayBuffer(user_share_encrypted.encryptedAesKey),
				encryptedData: base64ToArrayBuffer(user_share_encrypted.encryptedData),
				encryptionMethod: user_share_encrypted.encryptionMethod,
				id: user_share_encrypted.id,
				iv: base64ToArrayBuffer(user_share_encrypted.iv),
				ivForKeyEncryption: user_share_encrypted.ivForKeyEncryption,
				salt: user_share_encrypted.salt,
				credentialId: base64ToArrayBuffer(user_share_encrypted.credentialId),
			};

			// Decrypt to get the user share.
			const user_share = await webAuthn.decryptString(jsonData);
			console.log('Decrypted user share:', user_share);

			// Reconstruct the private key.
			const privateKeyHex = combineShares([app_share, user_share]);
			if (!privateKeyHex) {
				throw new Error('Failed to reconstruct private key from shares');
			}
			// Ensure the key has the proper "0x" prefix.
			const privateKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
			console.log('Reconstructed private key:', privateKey);

			// Initialize ethers with a custom RPC provider.
			// Verify that this RPC URL is correct for your testnet.
			const provider = new ethers.providers.JsonRpcProvider('https://testnet.evm.nodes.onflow.org');

			// Create a wallet instance from the private key and connect it to the provider.
			const walletInstance = new ethers.Wallet(privateKey, provider);
			const fromAddress = walletInstance.address;

			// Define the token contract address.
			const tokenAddress = '0x6E534F15c921915fC2e6aD87b7e395d448Bc9ECE';
			if (!tokenAddress) throw new Error('Token address not provided');
			console.log({ walletInstance })
			// Create a contract instance.
			const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, walletInstance);

			// Parse and validate the token amount.
			const numAmount = extractDecimalFromString(amount);
			if (isNaN(numAmount) || numAmount <= 0) {
				throw new Error('Invalid transfer amount');
			}
			const parsedAmount = ethers.utils.parseUnits(numAmount.toString(), 'ether');

			// Optional: Perform a static call to see if the transfer would succeed.

			// Estimate gas limit and fetch gas price.
			let gasLimit;

			// Fallback gas limit (adjust as needed)
			gasLimit = ethers.BigNumber.from(50000000);

			const gasPrice = await provider.getGasPrice();

			// Build transaction overrides.
			const overrides = {
				gasLimit,
				gasPrice,
			};

			// Send the token transfer.
			const txResponse = await tokenContract.burn(parsedAmount, overrides);
			console.log('Transaction sent:', txResponse.hash);

			// Wait for the transaction to be mined.
			const txReceipt = await txResponse.wait();
			return txReceipt.transactionHash;
		} catch (err: any) {
			console.error('Transaction error:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	const { exchangeRate } = useControlVariables()



        const getLastTransferRecord = () => {
                const snapshot = lastTransferRecordRef.current;
                lastTransferRecordRef.current = null;
                return snapshot;
        };

        const sendMoney = async (amount: string) => {
                const supabase = createClient();
                lastTransferRecordRef.current = null;

                if (!senderId) {
                        const message = 'Your account details are missing. Please sign in again.';
                        setError(message);
                        throw new Error(message);
                }

                if (!senderWallet) {
                        const message = 'Your wallet address could not be found. Please try again later.';
                        setError(message);
                        throw new Error(message);
                }

                if (!receiverWallet) {
                        const message = 'Recipient wallet address not found. Ask them to finish setting up their wallet.';
                        setError(message);
                        throw new Error(message);
                }

                const cubidUserId = userData?.cubidData?.id;
                if (!cubidUserId) {
                        const message = 'No valid Cubid user ID found';
                        setError(message);
                        throw new Error(message);
                }

                setLoading(true);
                setError(null);

                try {
                        const { data: shareData, error: shareError } = await supabase
                                .from('wallet_list')
                                .select('app_share')
                                .match({ user_id: cubidUserId })
                                .single();

                        if (shareError) throw new Error(shareError.message);
                        if (!shareData?.app_share) {
                                throw new Error('No app_share found for this user');
                        }

                        const { data: userShare, error: userShareError } = await supabase
                                .from('user_encrypted_share')
                                .select('user_share_encrypted')
                                .match({ user_id: cubidUserId })
                                .single();

                        if (userShareError) throw new Error(userShareError.message);
                        if (!userShare?.user_share_encrypted) {
                                throw new Error('No user_share_encrypted found for this user');
                        }

                        const { app_share } = shareData;
                        const { user_share_encrypted } = userShare;

                        const jsonData = {
                                encryptedAesKey: base64ToArrayBuffer(user_share_encrypted.encryptedAesKey),
                                encryptedData: base64ToArrayBuffer(user_share_encrypted.encryptedData),
                                encryptionMethod: user_share_encrypted.encryptionMethod,
                                id: user_share_encrypted.id,
                                iv: base64ToArrayBuffer(user_share_encrypted.iv),
                                ivForKeyEncryption: user_share_encrypted.ivForKeyEncryption,
                                salt: user_share_encrypted.salt,
                                credentialId: base64ToArrayBuffer(user_share_encrypted.credentialId),
                        };

                        const user_share = await webAuthn.decryptString(jsonData);
                        console.log('Decrypted user share:', user_share);

                        const privateKeyHex = combineShares([app_share, user_share]);
                        if (!privateKeyHex) {
                                throw new Error('Failed to reconstruct private key from shares');
                        }
                        const privateKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
                        console.log('Reconstructed private key:', privateKey);

                        const provider = new ethers.providers.JsonRpcProvider('https://testnet.evm.nodes.onflow.org');

                        const walletInstance = new ethers.Wallet(privateKey, provider);
                        const tokenAddress = '0x6E534F15c921915fC2e6aD87b7e395d448Bc9ECE';
                        if (!tokenAddress) throw new Error('Token address not provided');
                        console.log({ walletInstance })
                        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, walletInstance);

                        const numAmount = extractDecimalFromString(amount);
                        if (isNaN(numAmount) || numAmount <= 0) {
                                throw new Error('Invalid transfer amount');
                        }
                        const parsedAmount = ethers.utils.parseUnits(numAmount.toString(), 'ether');

                        let gasLimit;
                        try {
                                gasLimit = await tokenContract.estimateGas.transfer(receiverWallet, parsedAmount);
                                console.log('Estimated gas limit:', gasLimit.toString());
                        } catch (estimateError: any) {
                                console.warn('Gas estimation failed, falling back to default gas limit. Error:', estimateError.message);
                                gasLimit = ethers.BigNumber.from(50000000);
                        }
                        const gasPrice = await provider.getGasPrice();

                        const overrides = {
                                gasLimit,
                                gasPrice,
                        };

                        const txResponse = await tokenContract.transfer(receiverWallet, parsedAmount, overrides);
                        console.log('Transaction sent:', txResponse.hash);

                        const txReceipt = await txResponse.wait();
                        const transactionHash = txReceipt?.transactionHash ?? txResponse.hash;

                        try {
                                const transferResult = await transfer({
                                        recipient_wallet: receiverWallet,
                                        sender_wallet: senderWallet,
                                        token_price:
                                                typeof exchangeRate === 'number' && Number.isFinite(exchangeRate)
                                                        ? exchangeRate
                                                        : undefined,
                                        transfer_amount: numAmount,
                                        transfer_user_id: senderId,
                                });
                                lastTransferRecordRef.current = normaliseTransferResult(transferResult);
                        } catch (bookkeepingError: any) {
                                console.error('Bookkeeping error:', bookkeepingError);
                                lastTransferRecordRef.current = null;
                                const detail = bookkeepingError?.message ?? 'Bookkeeping failed';
                                throw new Error(`Payment confirmed on-chain (${transactionHash}) but bookkeeping failed: ${detail}`);
                        }

                        return transactionHash;
                } catch (err: any) {
                        console.error('Transaction error:', err);
                        lastTransferRecordRef.current = null;
                        const message = err instanceof Error && err.message
                                ? err.message
                                : 'We could not send your payment. Please try again.';
                        setError(message);
                        throw err instanceof Error ? err : new Error(message);
                } finally {
                        setLoading(false);
                }
        };

        return { senderWallet, receiverWallet, sendMoney, loading, error, burnMoney, getLastTransferRecord };
};
