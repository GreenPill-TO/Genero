import { ethers } from "ethers";
import { Shamir } from "@spliterati/shamir";
import { WebAuthnCrypto } from "cubid-wallet";
import { tokenAbi } from "@shared/hooks/abi";
import { transfer } from "@shared/utils/insertNotification";
import {
  normaliseTransferResult,
  type TransferRecordSnapshot,
} from "@shared/utils/transferRecord";
import { executeVoucherSwapAndTransfer } from "@shared/lib/vouchers/onchain";
import {
  resolveTokenRuntimeConfig,
  WebAuthnRequestInProgressError,
} from "./sendMoneyShared";

type SerializedEncryptedShare = {
  encryptedAesKey: string;
  encryptedData: string;
  encryptionMethod: string;
  id: string | number;
  iv: string;
  ivForKeyEncryption: string;
  salt: string;
  credentialId: string;
};

type SharePayload = {
  appShare: string;
  userShareEncrypted: SerializedEncryptedShare;
};

let webAuthnInstance: WebAuthnCrypto | null = null;
let webAuthnLocked = false;

const hexToUint8Array = (hex: string): Uint8Array => {
  let safeHex = hex;
  if (safeHex.startsWith("0x")) safeHex = safeHex.slice(2);
  const length = safeHex.length / 2;
  const uint8 = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    uint8[index] = Number.parseInt(safeHex.slice(index * 2, index * 2 + 2), 16);
  }
  return uint8;
};

const uint8ArrayToHex = (arr: Uint8Array): string =>
  Array.from(arr)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const combineShares = (shares: string[]): string => {
  try {
    const shareArrays = shares.map((share) => hexToUint8Array(share));
    const secretArray = Shamir.combine(shareArrays);
    return uint8ArrayToHex(secretArray);
  } catch (error: any) {
    throw new Error(`Failed to combine shares: ${error.message}`);
  }
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes.buffer;
};

const extractDecimalFromString = (value: string): number => {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
};

const getWebAuthn = () => {
  if (typeof window === "undefined") {
    throw new Error("WebAuthnCrypto is only available in the browser");
  }

  if (!webAuthnInstance) {
    webAuthnInstance = new WebAuthnCrypto();
  }

  return webAuthnInstance;
};

export async function runWithWebAuthnLock<T>(
  operation: () => Promise<T>
): Promise<T> {
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

async function decodeUserShare(jsonData: Record<string, unknown>): Promise<string> {
  try {
    return await runWithWebAuthnLock(() => getWebAuthn().decryptString(jsonData));
  } catch (error: any) {
    const message =
      typeof error?.message === "string" ? error.message.toLowerCase() : undefined;

    if (error instanceof WebAuthnRequestInProgressError) {
      throw error;
    }

    if (message?.includes("request is already pending")) {
      throw new WebAuthnRequestInProgressError();
    }

    throw error;
  }
}

async function buildWalletFromShares({ appShare, userShareEncrypted }: SharePayload) {
  const jsonData = {
    encryptedAesKey: base64ToArrayBuffer(userShareEncrypted.encryptedAesKey),
    encryptedData: base64ToArrayBuffer(userShareEncrypted.encryptedData),
    encryptionMethod: userShareEncrypted.encryptionMethod,
    id: userShareEncrypted.id,
    iv: base64ToArrayBuffer(userShareEncrypted.iv),
    ivForKeyEncryption: userShareEncrypted.ivForKeyEncryption,
    salt: userShareEncrypted.salt,
    credentialId: base64ToArrayBuffer(userShareEncrypted.credentialId),
  };

  const userShare = await decodeUserShare(jsonData);
  const privateKeyHex = combineShares([appShare, userShare]);
  if (!privateKeyHex) {
    throw new Error("Failed to reconstruct private key from shares");
  }

  const privateKey = privateKeyHex.startsWith("0x")
    ? privateKeyHex
    : `0x${privateKeyHex}`;
  const runtimeConfig = await resolveTokenRuntimeConfig();
  const provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);
  const walletInstance = new ethers.Wallet(privateKey, provider);

  return {
    runtimeConfig,
    provider,
    walletInstance,
  };
}

export async function burnToken({
  amount,
  sharePayload,
}: {
  amount: string | number;
  sharePayload: SharePayload;
}) {
  const { runtimeConfig, provider, walletInstance } = await buildWalletFromShares(
    sharePayload
  );

  const tokenContract = new ethers.Contract(
    runtimeConfig.tokenAddress,
    tokenAbi,
    walletInstance
  );
  const parsedAmount = extractDecimalFromString(String(amount));
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid transfer amount");
  }

  const value = ethers.utils.parseUnits(
    parsedAmount.toString(),
    runtimeConfig.decimals
  );
  const gasPrice = await provider.getGasPrice();
  const txResponse = await tokenContract.burn(value, {
    gasLimit: ethers.BigNumber.from(50000000),
    gasPrice,
  });
  const txReceipt = await txResponse.wait();
  return txReceipt.transactionHash;
}

export async function sendTokenTransfer({
  amount,
  senderWallet,
  receiverWallet,
  senderId,
  exchangeRate,
  sharePayload,
}: {
  amount: string | number;
  senderWallet: string;
  receiverWallet: string;
  senderId: number;
  exchangeRate?: number;
  sharePayload: SharePayload;
}): Promise<{
  transactionHash: string;
  transferRecord: TransferRecordSnapshot | null;
}> {
  const { runtimeConfig, provider, walletInstance } = await buildWalletFromShares(
    sharePayload
  );

  const tokenContract = new ethers.Contract(
    runtimeConfig.tokenAddress,
    tokenAbi,
    walletInstance
  );

  const parsedAmount = extractDecimalFromString(String(amount));
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid transfer amount");
  }

  const value = ethers.utils.parseUnits(
    parsedAmount.toString(),
    runtimeConfig.decimals
  );

  let gasLimit;
  try {
    gasLimit = await tokenContract.estimateGas.transfer(receiverWallet, value);
  } catch (estimateError: any) {
    console.warn(
      "Gas estimation failed, falling back to default gas limit. Error:",
      estimateError.message
    );
    gasLimit = ethers.BigNumber.from(50000000);
  }

  const gasPrice = await provider.getGasPrice();
  const txResponse = await tokenContract.transfer(receiverWallet, value, {
    gasLimit,
    gasPrice,
  });
  const txReceipt = await txResponse.wait();
  const transactionHash = txReceipt?.transactionHash ?? txResponse.hash;

  try {
    const transferResult = await transfer({
      recipient_wallet: receiverWallet,
      sender_wallet: senderWallet,
      token_price:
        typeof exchangeRate === "number" && Number.isFinite(exchangeRate)
          ? exchangeRate
          : undefined,
      transfer_amount: parsedAmount,
      transfer_user_id: senderId,
    });

    return {
      transactionHash,
      transferRecord: normaliseTransferResult(transferResult),
    };
  } catch (bookkeepingError: any) {
    const detail = bookkeepingError?.message ?? "Bookkeeping failed";
    throw new Error(
      `Payment confirmed on-chain (${transactionHash}) but bookkeeping failed: ${detail}`
    );
  }
}

export async function executeVoucherTransfer({
  amount,
  poolAddress,
  voucherTokenAddress,
  recipientWalletAddress,
  minAmountOut,
  tokenDecimals = 18,
  sharePayload,
}: {
  amount: string | number;
  poolAddress: string;
  voucherTokenAddress: string;
  recipientWalletAddress: string;
  minAmountOut?: string;
  tokenDecimals?: number;
  sharePayload: SharePayload;
}) {
  const { runtimeConfig, walletInstance } = await buildWalletFromShares(
    sharePayload
  );

  return executeVoucherSwapAndTransfer({
    signer: walletInstance,
    senderAddress: walletInstance.address as `0x${string}`,
    poolAddress: poolAddress as `0x${string}`,
    tcoinAddress: runtimeConfig.tokenAddress as `0x${string}`,
    voucherTokenAddress: voucherTokenAddress as `0x${string}`,
    recipientAddress: recipientWalletAddress as `0x${string}`,
    amountInTcoin: String(amount),
    minAmountOut: minAmountOut ?? String(amount),
    inputTokenDecimals: runtimeConfig.decimals,
    outputTokenDecimals: tokenDecimals,
  });
}

export function resetWebAuthnRuntimeForTests() {
  webAuthnLocked = false;
}
