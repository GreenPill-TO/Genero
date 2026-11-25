import { ethers } from "ethers";
import { Shamir } from "@spliterati/shamir";
import { WebAuthnCrypto } from "cubid-wallet";
import { tokenAbi } from "@shared/hooks/abi";
import { assertTorontoCoinWalletTokenIdentity } from "@shared/lib/contracts/torontocoinRuntime";
import type { Hex } from "viem";
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

type WebAuthnDecryptPayload = Parameters<WebAuthnCrypto["decryptString"]>[0];

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

export async function runAfterRuntimeChainCheck<T>(
  provider: { getNetwork: () => Promise<{ chainId: number }> },
  expectedChainId: number,
  operation: () => Promise<T>
): Promise<T> {
  const network = await provider.getNetwork();
  if (network.chainId !== expectedChainId) {
    throw new Error(
      `Wallet RPC chain mismatch: expected ${expectedChainId}, received ${network.chainId}.`
    );
  }
  return operation();
}

export async function runAfterTokenIdentityCheck<T>(
  identity: Parameters<typeof assertTorontoCoinWalletTokenIdentity>[0],
  operation: () => Promise<T>
): Promise<T> {
  assertTorontoCoinWalletTokenIdentity(identity);
  return operation();
}

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

async function decodeUserShare(jsonData: WebAuthnDecryptPayload): Promise<string> {
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
  const runtimeConfig = await resolveTokenRuntimeConfig();
  const provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);
  const privateKeyHex = await runAfterRuntimeChainCheck(
    provider,
    runtimeConfig.chainId,
    async () => {
      const readOnlyToken = new ethers.Contract(
        runtimeConfig.tokenAddress,
        tokenAbi,
        provider
      );
      const [bytecode, name, symbol, decimals] = await Promise.all([
        provider.getCode(runtimeConfig.tokenAddress),
        readOnlyToken.name(),
        readOnlyToken.symbol(),
        readOnlyToken.decimals(),
      ]);
      return runAfterTokenIdentityCheck({
        runtime: {
          chainId: runtimeConfig.chainId,
          cplTcoin: {
            address: runtimeConfig.tokenAddress,
            name: runtimeConfig.tokenName,
            symbol: runtimeConfig.tokenSymbol,
            decimals: runtimeConfig.decimals,
            explorerPath: `/token/${runtimeConfig.tokenAddress}`,
          },
          cplTcoinRuntimeCodeHash: runtimeConfig.cplTcoinRuntimeCodeHash,
        },
        actualChainId: runtimeConfig.chainId,
        bytecode: bytecode as Hex,
        name: String(name),
        symbol: String(symbol),
        decimals: Number(decimals),
      }, async () => {
        const jsonData = {
        encryptedAesKey: base64ToArrayBuffer(userShareEncrypted.encryptedAesKey),
        encryptedData: base64ToArrayBuffer(userShareEncrypted.encryptedData),
        encryptionMethod: userShareEncrypted.encryptionMethod,
        id: userShareEncrypted.id,
        iv: base64ToArrayBuffer(userShareEncrypted.iv),
        ivForKeyEncryption: userShareEncrypted.ivForKeyEncryption,
        salt: userShareEncrypted.salt,
        credentialId: base64ToArrayBuffer(userShareEncrypted.credentialId),
        } as unknown as WebAuthnDecryptPayload;

        const userShare = await decodeUserShare(jsonData);
        return combineShares([appShare, userShare]);
      });
    }
  );
  if (!privateKeyHex) {
    throw new Error("Failed to reconstruct private key from shares");
  }

  const privateKey = privateKeyHex.startsWith("0x")
    ? privateKeyHex
    : `0x${privateKeyHex}`;
  const walletInstance = new ethers.Wallet(privateKey, provider);
  const signingNetwork = await walletInstance.provider.getNetwork();
  if (signingNetwork.chainId !== runtimeConfig.chainId) {
    throw new Error(
      `Wallet signing provider chain mismatch: expected ${runtimeConfig.chainId}, received ${signingNetwork.chainId}.`
    );
  }

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

  if (runtimeConfig.purpose === "pay-link-only") {
    throw new Error("Burn is disabled in the isolated Preview pay-link profile.");
  }

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
  const gasLimit = await tokenContract.estimateGas.burn(value);
  if (gasLimit.gt(runtimeConfig.transferGasLimit)) {
    throw new Error("Burn gas estimate exceeds the reviewed transaction gas limit.");
  }
  const gasPrice = await provider.getGasPrice();
  if (gasPrice.gt(runtimeConfig.maxFeePerGasWei)) {
    throw new Error("Current gas price exceeds the reviewed fee ceiling.");
  }
  const txResponse = await tokenContract.burn(value, {
    gasLimit,
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

  const gasLimit = await tokenContract.estimateGas.transfer(receiverWallet, value);
  if (gasLimit.gt(runtimeConfig.transferGasLimit)) {
    throw new Error("Transfer gas estimate exceeds the reviewed transaction gas limit.");
  }

  const gasPrice = await provider.getGasPrice();
  if (gasPrice.gt(runtimeConfig.maxFeePerGasWei)) {
    throw new Error("Current gas price exceeds the reviewed fee ceiling.");
  }
  const txResponse = await tokenContract.transfer(receiverWallet, value, {
    gasLimit,
    gasPrice,
  });
  const txReceipt = await txResponse.wait();
  const transactionHash = txReceipt?.transactionHash ?? txResponse.hash;

  if (runtimeConfig.purpose === "pay-link-only") {
    return {
      transactionHash,
      transferRecord: null,
    };
  }

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

  if (runtimeConfig.purpose === "pay-link-only") {
    throw new Error("Voucher transfers are disabled in the isolated Preview pay-link profile.");
  }

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
