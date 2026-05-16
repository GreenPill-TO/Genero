import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { UserSettingsBootstrap } from "@shared/lib/userSettings/types";
import type { TPersona } from "@shared/types/persona";
import type { TCubidData } from "@shared/types/cubid";

export type EnsureUserRequest = {
  authMethod?: "phone" | "email" | string;
  fullContact?: string | null;
  cubidId?: string | null;
};

export type EnsureUserResponse = {
  created: boolean;
  user: TCubidData;
};

export type WalletRegisterCustodyRequest = {
  wallet: Record<string, unknown>;
  walletKey: Record<string, unknown>;
  userShare: {
    user_share_encrypted: Record<string, unknown>;
    credential_id: string | null;
    device_info?: Record<string, string> | null;
  };
};

export type WalletRegisterCustodyResponse = {
  walletKeyId: number | string;
  walletId?: number | string | null;
  bootstrap: UserSettingsBootstrap;
};

export type WalletCustodyShare = {
  id: number | string;
  credentialId: string | null;
  appInstanceId: number | null;
  lastUsedAt: string | null;
  createdAt: string | null;
  userShareEncrypted: Record<string, unknown> | null;
};

export type WalletCustodyMaterialResponse = {
  appInstanceId: number;
  appSlug: string;
  primaryWallet: string | null;
  walletKeyId: number | string;
  appShare: string | null;
  shares: WalletCustodyShare[];
};

export async function ensureAuthenticatedUserRecord(
  payload?: EnsureUserRequest,
  appContext?: AppScopeInput | null
): Promise<EnsureUserResponse> {
  return invokeEdgeFunction<EnsureUserResponse>("user-settings", "/auth/ensure-user", {
    method: "POST",
    body: (payload ?? {}) as Record<string, unknown>,
    appContext,
  });
}

export async function getEdgePersonas(appContext?: AppScopeInput | null): Promise<{ personas: TPersona[] }> {
  return invokeEdgeFunction<{ personas: TPersona[] }>("user-settings", "/personas", {
    method: "GET",
    appContext,
  });
}

export async function registerWalletCustody(
  payload: WalletRegisterCustodyRequest,
  appContext?: AppScopeInput | null
): Promise<WalletRegisterCustodyResponse> {
  return invokeEdgeFunction<WalletRegisterCustodyResponse>("user-settings", "/wallet/register-custody", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function getWalletCustodyMaterial(
  appContext?: AppScopeInput | null
): Promise<WalletCustodyMaterialResponse> {
  return invokeEdgeFunction<WalletCustodyMaterialResponse>("user-settings", "/wallet/custody-material", {
    method: "GET",
    appContext,
  });
}
