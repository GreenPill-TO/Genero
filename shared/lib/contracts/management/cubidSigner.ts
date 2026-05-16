// @ts-nocheck
import { ethers } from "ethers";
import { Shamir } from "@spliterati/shamir";
import { WebAuthnCrypto } from "cubid-wallet";
import { createClient } from "@shared/lib/supabase/client";

let webAuthnInstance: WebAuthnCrypto | null = null;
let webAuthnLocked = false;

function hexToUint8Array(hex: string): Uint8Array {
  const source = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(source.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(source.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getWebAuthn(): WebAuthnCrypto {
  if (typeof window === "undefined") {
    throw new Error("WebAuthn is only available in browser context.");
  }
  if (!webAuthnInstance) {
    webAuthnInstance = new WebAuthnCrypto();
  }
  return webAuthnInstance;
}

async function runWithWebAuthnLock<T>(operation: () => Promise<T>): Promise<T> {
  if (webAuthnLocked) {
    throw new Error("A WebAuthn verification is already in progress.");
  }
  webAuthnLocked = true;
  try {
    return await operation();
  } finally {
    webAuthnLocked = false;
  }
}

async function resolveWalletShares(userId: number) {
  const supabase = createClient();

  const { data: walletRow, error: walletRowError } = await supabase
    .from("wallet_list")
    .select("wallet_key_id, public_key")
    .match({ user_id: userId, namespace: "EVM" })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (walletRowError) {
    throw new Error(walletRowError.message);
  }

  const walletKeyId = walletRow?.wallet_key_id;
  if (!walletKeyId) {
    throw new Error("No wallet_key_id found for user.");
  }

  const { data: keyRow, error: keyError } = await supabase
    .from("wallet_keys")
    .select("app_share")
    .eq("id", walletKeyId)
    .single();

  if (keyError) {
    throw new Error(keyError.message);
  }

  const { data: userShare, error: userShareError } = await supabase
    .from("user_encrypted_share")
    .select("user_share_encrypted")
    .match({ wallet_key_id: walletKeyId })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (userShareError) {
    throw new Error(userShareError.message);
  }

  if (!keyRow?.app_share || !userShare?.user_share_encrypted) {
    throw new Error("Missing wallet share data for signer creation.");
  }

  return {
    appShare: keyRow.app_share,
    userShareEncrypted: userShare.user_share_encrypted,
    publicKey: walletRow?.public_key ?? null,
  };
}

async function reconstructPrivateKey(userId: number): Promise<string> {
  const { appShare, userShareEncrypted } = await resolveWalletShares(userId);

  const encryptedPayload = {
    encryptedAesKey: base64ToArrayBuffer(userShareEncrypted.encryptedAesKey),
    encryptedData: base64ToArrayBuffer(userShareEncrypted.encryptedData),
    encryptionMethod: userShareEncrypted.encryptionMethod,
    id: userShareEncrypted.id,
    iv: base64ToArrayBuffer(userShareEncrypted.iv),
    ivForKeyEncryption: userShareEncrypted.ivForKeyEncryption,
    salt: userShareEncrypted.salt,
    credentialId: base64ToArrayBuffer(userShareEncrypted.credentialId),
  };

  const userShareHex = await runWithWebAuthnLock(() => getWebAuthn().decryptString(encryptedPayload));

  const combined = Shamir.combine([hexToUint8Array(appShare), hexToUint8Array(userShareHex)]);
  const privateKeyHex = uint8ArrayToHex(combined);
  return privateKeyHex.startsWith("0x") ? privateKeyHex : `0x${privateKeyHex}`;
}

export async function resolveCubidWalletAddress(userId: number): Promise<string | null> {
  const { publicKey } = await resolveWalletShares(userId);
  return publicKey;
}

export async function createCubidWalletSigner(userId: number, rpcUrl: string): Promise<ethers.Wallet> {
  const privateKey = await reconstructPrivateKey(userId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}
