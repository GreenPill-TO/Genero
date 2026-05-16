import type { AppScopeInput } from "./types";

export type PaymentRequestStatus = "pending" | "paid" | "dismissed" | "cancelled" | "expired";

export type PaymentRequestRecord = {
  id: number;
  citycoinId: number | null;
  citySlug: string | null;
  originAppInstanceId: number | null;
  originAppSlug: string | null;
  requestBy: number | null;
  requestFrom: number | null;
  amountRequested: number | null;
  transactionId: number | string | null;
  status: PaymentRequestStatus;
  isOpen: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  requesterFullName: string | null;
  requesterUsername: string | null;
  requesterProfileImageUrl: string | null;
  requesterWalletPublicKey: string | null;
  recipientFullName: string | null;
  recipientUsername: string | null;
  recipientProfileImageUrl: string | null;
  recipientWalletPublicKey: string | null;
};

export type IncomingPaymentRequestsResponse = {
  citySlug: string;
  requests: PaymentRequestRecord[];
};

export type OutgoingPaymentRequestsResponse = {
  citySlug: string;
  requests: PaymentRequestRecord[];
};

export type RecentPaymentRequestParticipant = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletPublicKey: string | null;
  lastInteractionAt: string | null;
};

export type RecentPaymentRequestParticipantsResponse = {
  citySlug: string;
  participants: RecentPaymentRequestParticipant[];
};

export type CreatePaymentRequestInput = {
  requestFrom?: number | null;
  amountRequested?: number | null;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};

export type MarkPaymentRequestPaidInput = {
  requestId: number;
  transactionId?: number | null;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};

export type DismissPaymentRequestInput = {
  requestId: number;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};

export type CancelPaymentRequestInput = {
  requestId: number;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};
