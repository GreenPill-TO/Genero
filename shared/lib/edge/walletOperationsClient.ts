import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  WalletContactDetailResponse,
  WalletContactsResponse,
  WalletLookupUserResponse,
  WalletNotificationResponse,
  WalletRecentsResponse,
  WalletTransferRecordResponse,
  WalletTransactionsResponse,
} from "./walletOperations";

export async function getWalletContacts(appContext?: AppScopeInput | null): Promise<WalletContactsResponse> {
  return invokeEdgeFunction<WalletContactsResponse>("wallet-operations", "/contacts", {
    method: "GET",
    appContext,
  });
}

export async function connectWalletContact(
  payload: { connectedUserId: number; state?: string },
  appContext?: AppScopeInput | null
): Promise<WalletContactDetailResponse> {
  return invokeEdgeFunction<WalletContactDetailResponse>("wallet-operations", "/contacts/connect", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function updateWalletContactState(
  payload: { connectedUserId: number; state: "added" | "removed" | "new" },
  appContext?: AppScopeInput | null
): Promise<WalletContactDetailResponse> {
  return invokeEdgeFunction<WalletContactDetailResponse>("wallet-operations", "/contacts/state", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function getWalletContactDetail(
  contactId: number,
  appContext?: AppScopeInput | null
): Promise<WalletContactDetailResponse> {
  return invokeEdgeFunction<WalletContactDetailResponse>("wallet-operations", `/contacts/${contactId}`, {
    method: "GET",
    appContext,
  });
}

export async function getWalletRecents(appContext?: AppScopeInput | null): Promise<WalletRecentsResponse> {
  return invokeEdgeFunction<WalletRecentsResponse>("wallet-operations", "/recents", {
    method: "GET",
    appContext,
  });
}

export async function getWalletTransactionHistory(
  appContext?: AppScopeInput | null
): Promise<WalletTransactionsResponse> {
  return invokeEdgeFunction<WalletTransactionsResponse>("wallet-operations", "/transactions/history", {
    method: "GET",
    appContext,
  });
}

export async function getWalletContactTransactionHistory(
  contactId: number,
  appContext?: AppScopeInput | null
): Promise<WalletTransactionsResponse> {
  return invokeEdgeFunction<WalletTransactionsResponse>(
    "wallet-operations",
    `/transactions/contact/${contactId}`,
    {
      method: "GET",
      appContext,
    }
  );
}

export async function lookupWalletUserByIdentifier(
  payload: { userIdentifier: string },
  appContext?: AppScopeInput | null
): Promise<WalletLookupUserResponse> {
  return invokeEdgeFunction<WalletLookupUserResponse>("wallet-operations", "/lookup/user-by-identifier", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function recordWalletTransfer(
  payload: {
    recipient_wallet: string;
    sender_wallet: string;
    token_price?: number;
    transfer_amount: number;
    transfer_user_id: number;
  },
  appContext?: AppScopeInput | null
): Promise<WalletTransferRecordResponse> {
  return invokeEdgeFunction<WalletTransferRecordResponse>("wallet-operations", "/transfers/record", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function sendWalletSuccessNotification(
  payload: {
    user_id: string | number;
    notification: string;
    additionalData?: Record<string, unknown>;
  },
  appContext?: AppScopeInput | null
): Promise<WalletNotificationResponse> {
  return invokeEdgeFunction<WalletNotificationResponse>("wallet-operations", "/notifications/success", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function sendWalletAdminNotification(
  payload: { user_id: string; notification: string },
  appContext?: AppScopeInput | null
): Promise<WalletNotificationResponse> {
  return invokeEdgeFunction<WalletNotificationResponse>("wallet-operations", "/notifications/admin", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}
