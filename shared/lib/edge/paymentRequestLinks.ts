import type { AppScopeInput } from "./types";

export type PaymentRequestLinkMode = "rotating_multi_use" | "single_use";
export type PaymentRequestLinkState = "ready" | "expired" | "consumed" | "invalid";

export type PaymentRequestLinkRecipient = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletAddress: string | null;
  userIdentifier: string | null;
};

export type PaymentRequestLinkResolution = {
  token: string;
  state: PaymentRequestLinkState;
  mode: PaymentRequestLinkMode | null;
  amountRequested: number | null;
  expiresAt: string | null;
  consumedAt: string | null;
  url: string | null;
  recipient: PaymentRequestLinkRecipient | null;
};

export type PaymentRequestLinkResponse = {
  link: PaymentRequestLinkResolution;
};

export type CreatePaymentRequestLinkInput = {
  amountRequested?: number | null;
  mode?: PaymentRequestLinkMode;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};

export type ConsumePaymentRequestLinkInput = {
  token: string;
  transactionId?: number | null;
  appContext?: AppScopeInput | null;
  citySlug?: string | null;
};
