export type WalletOperationUser = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletAddress: string | null;
  bio?: string | null;
  country?: string | null;
  address?: string | null;
  state?: string | null;
  lastInteractionAt?: string | null;
  userIdentifier?: string | null;
};

export type WalletTransactionHistoryItem = {
  id: number;
  amount: number;
  currency: string;
  walletFrom: string | null;
  walletTo: string | null;
  createdAt: string | null;
  direction: "sent" | "received" | "internal";
  counterpartyWallet: string | null;
};

export type WalletTransactionsResponse = {
  transactions: WalletTransactionHistoryItem[];
};

export type WalletContactsResponse = {
  contacts: WalletOperationUser[];
};

export type WalletContactDetailResponse = {
  contact: WalletOperationUser | null;
};

export type WalletRecentsResponse = {
  participants: WalletOperationUser[];
};

export type WalletLookupUserResponse = {
  user: WalletOperationUser | null;
};

export type WalletImportedContact = {
  id: number;
  displayName: string | null;
  email: string;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WalletContactImportPreference = {
  granted: boolean;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type WalletContactImportsResponse = {
  preference: WalletContactImportPreference | null;
  importedContacts: WalletImportedContact[];
};

export type WalletInviteBatch = {
  id: number;
  source: string;
  status: string;
  subject: string;
  message: string;
  recipientCount: number;
  createdAt: string | null;
};

export type WalletInviteBatchResponse = {
  batch: WalletInviteBatch | null;
};

export type WalletTransferRecordResponse = {
  record: unknown;
};

export type WalletNotificationResponse = {
  ok: boolean;
};
