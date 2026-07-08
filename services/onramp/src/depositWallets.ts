import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress, type Address } from "viem";
import { utils as ethersUtils } from "ethers";
import { resolveOnrampConfig } from "./config";

export type DerivedWallet = {
  index: number;
  address: Address;
  privateKey: `0x${string}`;
};

function looksLikeMnemonic(value: string): boolean {
  return value.trim().split(/\s+/).length >= 12;
}

function normalizeSeedHex(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]+$/.test(prefixed)) {
    throw new Error("ONRAMP_HD_MASTER_SEED must be either a mnemonic or a hex seed.");
  }
  return prefixed as `0x${string}`;
}

function resolveHdRoot(seedOrMnemonic: string) {
  if (looksLikeMnemonic(seedOrMnemonic)) {
    return ethersUtils.HDNode.fromMnemonic(seedOrMnemonic.trim());
  }

  const seedHex = normalizeSeedHex(seedOrMnemonic);
  return ethersUtils.HDNode.fromSeed(ethersUtils.arrayify(seedHex));
}

export function deriveWalletAtIndex(index: number): DerivedWallet {
  if (!Number.isFinite(index) || index < 0) {
    throw new Error("Invalid derivation index.");
  }

  const config = resolveOnrampConfig();
  const root = resolveHdRoot(config.hdMasterSeed);
  const path = `${config.hdDerivationPathBase}/${Math.trunc(index)}`;
  const child = root.derivePath(path);

  if (!child.privateKey) {
    throw new Error(`Unable to derive private key for path ${path}`);
  }

  return {
    index: Math.trunc(index),
    address: getAddress(child.address),
    privateKey: child.privateKey.toLowerCase() as `0x${string}`,
  };
}

export async function getOrCreateDepositWallet(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
  citySlug: string;
  chainId: number;
}): Promise<{ wallet: DerivedWallet; created: boolean; rowId: string }> {
  const existingResult = await options.supabase
    .from("onramp_deposit_wallets")
    .select("id,address,derivation_index,status")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .eq("chain_id", options.chainId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(`Failed to load onramp deposit wallet: ${existingResult.error.message}`);
  }

  if (existingResult.data) {
    const index = Number(existingResult.data.derivation_index);
    const wallet = deriveWalletAtIndex(index);

    if (wallet.address.toLowerCase() !== String(existingResult.data.address).toLowerCase()) {
      throw new Error("Derived wallet address mismatch for stored onramp deposit wallet.");
    }

    if (existingResult.data.status !== "active") {
      throw new Error("Onramp deposit wallet is not active for this user.");
    }

    return {
      wallet,
      created: false,
      rowId: String(existingResult.data.id),
    };
  }

  const derivationIndex = Math.max(1, Math.trunc(options.userId));
  const wallet = deriveWalletAtIndex(derivationIndex);
  const nowIso = new Date().toISOString();

  const insertResult = await options.supabase
    .from("onramp_deposit_wallets")
    .insert({
      user_id: options.userId,
      app_instance_id: options.appInstanceId,
      city_slug: options.citySlug,
      chain_id: options.chainId,
      address: wallet.address,
      derivation_index: derivationIndex,
      status: "active",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id,address,derivation_index")
    .maybeSingle();

  if (insertResult.error) {
    // Handle race by re-reading active row.
    const raceRead = await options.supabase
      .from("onramp_deposit_wallets")
      .select("id,address,derivation_index,status")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .eq("chain_id", options.chainId)
      .limit(1)
      .maybeSingle();

    if (raceRead.error || !raceRead.data) {
      throw new Error(`Failed to create onramp deposit wallet: ${insertResult.error.message}`);
    }

    const raceIndex = Number(raceRead.data.derivation_index);
    const raceWallet = deriveWalletAtIndex(raceIndex);
    return {
      wallet: raceWallet,
      created: false,
      rowId: String(raceRead.data.id),
    };
  }

  const row = insertResult.data;
  if (!row?.id) {
    throw new Error(`Failed to create onramp deposit wallet (${randomUUID()}).`);
  }

  return {
    wallet,
    created: true,
    rowId: String(row.id),
  };
}
