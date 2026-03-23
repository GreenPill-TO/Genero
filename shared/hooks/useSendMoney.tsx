// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Shamir } from '@spliterati/shamir';
import { useAuth } from '@shared/api/hooks/useAuth';
import { tokenAbi } from './abi';
import { WebAuthnCrypto } from 'cubid-wallet';
import { transfer } from '@shared/utils/insertNotification';
import { normaliseTransferResult, TransferRecordSnapshot } from '@shared/utils/transferRecord';
import { useControlVariables } from '@shared/hooks/useGetLatestExchangeRate';
import { normaliseCredentialId } from '@shared/api/services/supabaseService';
import { getActiveCityContracts, getRpcUrlForChainId } from '@shared/lib/contracts/cityContracts';
import { getTorontoCoinRuntimeConfig, TORONTOCOIN_RUNTIME } from '@shared/lib/contracts/torontocoinRuntime';
import { executeVoucherSwapAndTransfer } from '@shared/lib/vouchers/onchain';
import { getWalletCustodyMaterial } from '@shared/lib/edge/userSettingsClient';
import { getWalletContactDetail } from '@shared/lib/edge/walletOperationsClient';


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

let webAuthnInstance: WebAuthnCrypto | null = null;
let webAuthnLocked = false;

export class WebAuthnRequestInProgressError extends Error {
        constructor() {
                super(
                        'A WebAuthn verification is already in progress. Complete or cancel the pending approval before trying again.'
                );
                this.name = 'WebAuthnRequestInProgressError';
        }
}

const getWebAuthn = () => {
        if (typeof window === 'undefined') {
                throw new Error('WebAuthnCrypto is only available in the browser');
        }

        if (!webAuthnInstance) {
                webAuthnInstance = new WebAuthnCrypto();
        }

        return webAuthnInstance;
};

async function runWithWebAuthnLock<T>(operation: () => Promise<T>): Promise<T> {
        if (webAuthnLocked) {
                throw new WebAuthnRequestInProgressError();
        }

        webAuthnLocked = true;
        try {
                return await operation();
        } finally {
                webAuthnLocked = false;
        }
}

const decodeUserShare = async (jsonData: any): Promise<string> => {
        try {
                return await runWithWebAuthnLock(() => getWebAuthn().decryptString(jsonData));
        } catch (error: any) {
                const message: string | undefined =
                        typeof error?.message === 'string' ? error.message.toLowerCase() : undefined;

                if (error instanceof WebAuthnRequestInProgressError) {
                        throw error;
                }

                if (message?.includes('request is already pending')) {
                        throw new WebAuthnRequestInProgressError();
                }

                throw error;
        }
};

async function resolveTokenRuntimeConfig() {
        const torontoCoinRuntime = getTorontoCoinRuntimeConfig({
                citySlug: process.env.NEXT_PUBLIC_CITYCOIN ?? 'tcoin',
                chainId: TORONTOCOIN_RUNTIME.chainId,
        });

        if (torontoCoinRuntime) {
                return {
                        tokenAddress: torontoCoinRuntime.cplTcoin.address,
                        rpcUrl: torontoCoinRuntime.rpcUrl,
                        chainId: torontoCoinRuntime.chainId,
                        decimals: torontoCoinRuntime.cplTcoin.decimals,
                };
        }

        try {
                const activeContracts = await getActiveCityContracts();
                return {
                        tokenAddress: activeContracts.contracts.TCOIN,
                        rpcUrl: getRpcUrlForChainId(activeContracts.chainId),
                        chainId: activeContracts.chainId,
                        decimals: 18,
                };
        } catch (error) {
                console.warn('Falling back to default TorontoCoin runtime config.', error);
                return {
                        tokenAddress: TORONTOCOIN_RUNTIME.cplTcoin.address,
                        rpcUrl: getRpcUrlForChainId(42220),
                        chainId: 42220,
                        decimals: TORONTOCOIN_RUNTIME.cplTcoin.decimals,
                };
        }
}

export const __internal = {
        runWithWebAuthnLock,
        resolveTokenRuntimeConfig,
        resetWebAuthnLock: () => {
                webAuthnLocked = false;
        },
        resolveShareSelection,
};

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

type UserShareRow = {
        id: number;
        credential_id: string | null;
        user_share_encrypted: any;
};

function resolveShareSelection({
        userShares,
        activeCredentialId,
        activeAppSlug,
}: {
        userShares: UserShareRow[] | null | undefined;
        activeCredentialId: string | null;
        activeAppSlug?: string | null;
}) {
        if (!userShares || userShares.length === 0) {
                const scope = activeAppSlug ? ` for app instance "${activeAppSlug}"` : '';
                throw new Error(`No user shares were found${scope}. Reconnect your wallet to refresh passkey credentials.`);
        }

        const matchingCredential = activeCredentialId
                ? userShares.find((row) => normaliseCredentialId(row.credential_id) === activeCredentialId)
                : null;
        const selectedShare = matchingCredential ?? userShares[0];
        const credentialCandidates = userShares
                .map((row) => normaliseCredentialId(row.credential_id))
                .filter((value): value is string => Boolean(value));

        return {
                selectedShare,
                credentialCandidates,
                usedCredentialFallback: Boolean(activeCredentialId && !matchingCredential),
        };
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
        const [credentialCandidates, setCredentialCandidates] = useState<string[]>([]);

        const getActiveCredentialId = (): string | null => {
                if (typeof window === 'undefined') {
                        return null;
                }
                const fromStorage = window.localStorage.getItem('tcoin_wallet_activeWalletCredentialId');
                if (fromStorage === null) {
                        return null;
                }
                return normaliseCredentialId(fromStorage);
        };

	// Fetch wallet address from Supabase using Cubid.
        const fetchWalletAddress = async (
                userId: number | null | undefined,
                setWallet: (wallet: string | null) => void
        ) => {
                if (!userId) return;
                try {
                        if (userData?.cubidData?.id === userId) {
                                const custody = await getWalletCustodyMaterial();
                                setWallet(custody.primaryWallet?.publicKey ?? null);
                                return;
                        }

                        const contact = await getWalletContactDetail(userId, { citySlug: 'tcoin' });
                        setWallet((contact.contact as { wallet_address?: string | null })?.wallet_address ?? null);
                } catch (err: any) {
                        console.error('fetchWalletAddress error', err);
                        setError(err.message);
                }
        };

	

        const fetchWalletShares = async (userId: number) => {
                const activeCredentialId = getActiveCredentialId();
                const custody = await getWalletCustodyMaterial();

                if (!custody.appShare) {
                        throw new Error('No app_share found for this wallet key');
                }

                const selection = resolveShareSelection({
                        userShares: (custody.shares as UserShareRow[] | null | undefined) ?? [],
                        activeCredentialId,
                        activeAppSlug: custody.appSlug,
                });
                setCredentialCandidates(selection.credentialCandidates);

                if (selection.usedCredentialFallback && activeCredentialId) {
                        console.warn(
                                `Active credential "${activeCredentialId}" did not match a stored user share. Falling back to the most recently used credential.`
                        );
                }

                if (!selection.selectedShare?.user_share_encrypted) {
                        throw new Error('No user_share_encrypted found for this wallet key');
                }

                return {
                        app_share: custody.appShare,
                        user_share_encrypted: selection.selectedShare.user_share_encrypted,
                };
        };

	useEffect(() => {
		console.log({ receiverId })
		if (senderId) fetchWalletAddress(senderId, setSenderWallet);
		if (receiverId) fetchWalletAddress(receiverId, setReceiverWallet);
	}, [senderId, receiverId]);

	// Populate credentialCandidates early so they're available to consumers
	useEffect(() => {
		const loadCredentialCandidates = async () => {
			if (!userData?.cubidData?.id) return;
			
			try {
				const custody = await getWalletCustodyMaterial();

				if (custody.shares && custody.shares.length > 0) {
					const options = custody.shares
						.map((row) => normaliseCredentialId(row.credential_id))
						.filter((value): value is string => Boolean(value));
					setCredentialCandidates(options);
				}
			} catch (err) {
				console.warn('Could not preload credential candidates:', err);
			}
		};

		loadCredentialCandidates();
	}, [userData?.cubidData?.id]); // Only depend on the user ID to avoid unnecessary re-fetches

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
			const { app_share, user_share_encrypted } = await fetchWalletShares(cubidUserId);

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
                        const user_share = await decodeUserShare(jsonData);
			console.log('Decrypted user share:', user_share);

			// Reconstruct the private key.
			const privateKeyHex = combineShares([app_share, user_share]);
			if (!privateKeyHex) {
				throw new Error('Failed to reconstruct private key from shares');
			}
			// Ensure the key has the proper "0x" prefix.
			const privateKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
			console.log('Reconstructed private key:', privateKey);

			const runtimeConfig = await resolveTokenRuntimeConfig();
			const provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);

			// Create a wallet instance from the private key and connect it to the provider.
			const walletInstance = new ethers.Wallet(privateKey, provider);
			const fromAddress = walletInstance.address;

			const tokenAddress = runtimeConfig.tokenAddress;
			console.log({ walletInstance })
			// Create a contract instance.
			const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, walletInstance);

			// Parse and validate the token amount.
			const numAmount = extractDecimalFromString(amount);
			if (isNaN(numAmount) || numAmount <= 0) {
				throw new Error('Invalid transfer amount');
			}
			const parsedAmount = ethers.utils.parseUnits(numAmount.toString(), runtimeConfig.decimals);

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
                        const { app_share, user_share_encrypted } = await fetchWalletShares(cubidUserId);

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

                        const user_share = await decodeUserShare(jsonData);
                        console.log('Decrypted user share:', user_share);

                        const privateKeyHex = combineShares([app_share, user_share]);
                        if (!privateKeyHex) {
                                throw new Error('Failed to reconstruct private key from shares');
                        }
                        const privateKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
                        console.log('Reconstructed private key:', privateKey);

                        const runtimeConfig = await resolveTokenRuntimeConfig();
                        const provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);

                        const walletInstance = new ethers.Wallet(privateKey, provider);
                        const tokenAddress = runtimeConfig.tokenAddress;
                        console.log({ walletInstance })
                        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, walletInstance);

                        const numAmount = extractDecimalFromString(amount);
                        if (isNaN(numAmount) || numAmount <= 0) {
                                throw new Error('Invalid transfer amount');
                        }
                        const parsedAmount = ethers.utils.parseUnits(numAmount.toString(), runtimeConfig.decimals);

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
                        if (!(err instanceof WebAuthnRequestInProgressError)) {
                                console.error('Transaction error:', err);
                        }
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

        const executeVoucherPayment = async ({
                amount,
                poolAddress,
                voucherTokenAddress,
                recipientWalletAddress,
                minAmountOut,
                tokenDecimals = 18,
        }: {
                amount: string;
                poolAddress: string;
                voucherTokenAddress: string;
                recipientWalletAddress: string;
                minAmountOut?: string;
                tokenDecimals?: number;
        }) => {
                if (!senderWallet) {
                        const message = 'Your wallet address could not be found. Please try again later.';
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
                        const { app_share, user_share_encrypted } = await fetchWalletShares(cubidUserId);

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

                        const user_share = await decodeUserShare(jsonData);
                        const privateKeyHex = combineShares([app_share, user_share]);
                        if (!privateKeyHex) {
                                throw new Error('Failed to reconstruct private key from shares');
                        }
                        const privateKey = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;

                        const runtimeConfig = await resolveTokenRuntimeConfig();
                        const provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);
                        const walletInstance = new ethers.Wallet(privateKey, provider);

                        const result = await executeVoucherSwapAndTransfer({
                                signer: walletInstance,
                                senderAddress: walletInstance.address as `0x${string}`,
                                poolAddress: poolAddress as `0x${string}`,
                                tcoinAddress: runtimeConfig.tokenAddress as `0x${string}`,
                                voucherTokenAddress: voucherTokenAddress as `0x${string}`,
                                recipientAddress: recipientWalletAddress as `0x${string}`,
                                amountInTcoin: amount,
                                minAmountOut: minAmountOut ?? amount,
                                inputTokenDecimals: runtimeConfig.decimals,
                                outputTokenDecimals: tokenDecimals,
                        });

                        return result;
                } catch (err: any) {
                        if (!(err instanceof WebAuthnRequestInProgressError)) {
                                console.error('Voucher payment error:', err);
                        }
                        const message = err instanceof Error && err.message
                                ? err.message
                                : 'We could not complete this voucher payment. Please try again.';
                        setError(message);
                        throw err instanceof Error ? err : new Error(message);
                } finally {
                        setLoading(false);
                }
        };

        return {
                senderWallet,
                receiverWallet,
                sendMoney,
                executeVoucherPayment,
                loading,
                error,
                burnMoney,
                getLastTransferRecord,
                credentialCandidates,
        };
};
