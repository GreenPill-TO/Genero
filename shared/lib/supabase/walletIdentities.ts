import { createClient } from "@shared/lib/supabase/client";

type SupabaseClientLike = ReturnType<typeof createClient>;

export type WalletIdentityRecord = {
  user_id: number;
  public_key: string;
  wallet_key_id: string | null;
  wallet_ready: boolean;
  has_encrypted_share: boolean;
};

function getClient(client?: SupabaseClientLike) {
  return client ?? createClient();
}

function normaliseWalletAddress(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normaliseUserId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normaliseWalletRow(row: Record<string, unknown>): WalletIdentityRecord | null {
  const userId = normaliseUserId(row.user_id);
  const publicKey = normaliseWalletAddress(row.public_key);
  if (userId == null || publicKey === "") {
    return null;
  }

  return {
    user_id: userId,
    public_key: publicKey,
    wallet_key_id: typeof row.wallet_key_id === "string" ? row.wallet_key_id : null,
    wallet_ready: row.wallet_ready === true,
    has_encrypted_share: row.has_encrypted_share === true,
  };
}

export async function listWalletIdentitiesForUser(
  userId: number,
  client?: SupabaseClientLike
): Promise<WalletIdentityRecord[]> {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("v_wallet_identities_v1")
    .select("user_id,public_key,wallet_key_id,wallet_ready,has_encrypted_share")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => normaliseWalletRow(row as Record<string, unknown>))
    .filter((row): row is WalletIdentityRecord => row != null);
}

export async function listWalletPublicKeysForUser(
  userId: number,
  client?: SupabaseClientLike
): Promise<string[]> {
  const rows = await listWalletIdentitiesForUser(userId, client);
  return rows.map((row) => row.public_key);
}

export async function mapPrimaryWalletsByUserIds(
  userIds: number[],
  client?: SupabaseClientLike
): Promise<Map<number, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("v_wallet_identities_v1")
    .select("user_id,public_key,wallet_key_id,wallet_ready,has_encrypted_share")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  const walletsById = new Map<number, string>();
  for (const row of data ?? []) {
    const normalised = normaliseWalletRow(row as Record<string, unknown>);
    if (!normalised) {
      continue;
    }
    if (!walletsById.has(normalised.user_id)) {
      walletsById.set(normalised.user_id, normalised.public_key);
    }
  }
  return walletsById;
}

export async function mapUserIdsByWallets(
  wallets: string[],
  client?: SupabaseClientLike
): Promise<Map<string, number>> {
  const requestedWallets = new Map<string, string[]>();
  wallets.forEach((wallet) => {
    const normalised = normaliseWalletAddress(wallet);
    if (!normalised) {
      return;
    }

    const existing = requestedWallets.get(normalised) ?? [];
    existing.push(wallet);
    requestedWallets.set(normalised, existing);
  });

  const normalisedWallets = Array.from(requestedWallets.keys());
  if (normalisedWallets.length === 0) {
    return new Map();
  }

  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("v_wallet_identities_v1")
    .select("user_id,public_key,wallet_key_id,wallet_ready,has_encrypted_share")
    .in("public_key", normalisedWallets);

  if (error) {
    throw error;
  }

  const walletToUserId = new Map<string, number>();
  for (const row of data ?? []) {
    const normalised = normaliseWalletRow(row as Record<string, unknown>);
    if (!normalised) {
      continue;
    }

    if (!walletToUserId.has(normalised.public_key)) {
      walletToUserId.set(normalised.public_key, normalised.user_id);
    }

    for (const originalWallet of requestedWallets.get(normalised.public_key) ?? []) {
      if (!walletToUserId.has(originalWallet)) {
        walletToUserId.set(originalWallet, normalised.user_id);
      }
    }
  }
  return walletToUserId;
}
