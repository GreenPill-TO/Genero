import type {
  CreateOnrampSessionRequest,
  CreateOnrampSessionResponse,
  OnrampAdminSessionSummary,
  OnrampCheckoutSession,
} from "@shared/lib/onramp/types";

export type { CreateOnrampSessionRequest, CreateOnrampSessionResponse, OnrampAdminSessionSummary, OnrampCheckoutSession };

export type OnrampStatusResponse = {
  session: OnrampCheckoutSession;
};

export type OnrampTouchResponse = {
  scanned: number;
  settled: number;
  manualReview: number;
  skipped: number;
  disabled?: boolean;
};

export type RetryOnrampSessionResponse = {
  sessionId: string;
  result: {
    sessionId: string;
    status: string;
    skipped: boolean;
    reason?: string;
    mintTxHash?: string;
  };
};

export type LegacyRampAdminRequestsResponse = {
  citySlug: string;
  appInstanceId: number;
  onRampRequests: Array<Record<string, unknown>>;
  offRampRequests: Array<Record<string, unknown>>;
  statuses: Array<Record<string, unknown>>;
};

export type OnrampAdminSessionsResponse = {
  citySlug: string;
  appInstanceId: number;
  sessions: OnrampAdminSessionSummary[];
};

export type OnrampCheckoutSessionSummary = {
  id: string;
  userId: number;
  provider: string;
  fiatAmount: string;
  fiatCurrency: string;
  status: string;
  statusReason: string | null;
  depositAddress: string;
  recipientWallet: string;
  incomingUsdcTxHash: string | null;
  mintTxHash: string | null;
  tcoinOutAmount: string | null;
  latestAttemptNo: number | null;
  latestAttemptMode: string | null;
  latestAttemptState: string | null;
  latestAttemptError: string | null;
  createdAt: string;
  updatedAt: string;
};
