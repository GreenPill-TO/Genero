import type {
  CreateOnrampSessionRequest,
  CreateOnrampSessionResponse,
  OnrampAdminSessionSummary,
  OnrampCheckoutSession,
} from "@shared/lib/onramp/types";
import type { OperationalState } from "./types";

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
    routerTxHash?: string;
  };
};

export type AdminCashOperationUser = {
  full_name: string | null;
  email: string | null;
};

export type AdminInteracOnrampRequest = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  amount: number | null;
  amount_override: number | null;
  status: string | null;
  admin_notes: string | null;
  bank_reference: string | null;
  interac_code: string | null;
  is_sent: boolean | null;
  approved_timestamp: string | null;
  user_id: number | null;
  users: AdminCashOperationUser;
};

export type AdminManualOfframpRequest = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  cad_to_user: number | null;
  tokens_burned: number | null;
  exchange_rate: number | null;
  cad_off_ramp_fee: number | null;
  admin_notes: string | null;
  bank_reference_number: string | null;
  status: string | null;
  interac_transfer_target: string | null;
  wallet_account: string | null;
  user_id: number | null;
  users: AdminCashOperationUser;
};

export type LegacyRampAdminRequestsResponse = {
  citySlug: string;
  appInstanceId: number;
  state: OperationalState;
  setupMessage?: string | null;
  onRampRequests: AdminInteracOnrampRequest[];
  offRampRequests: AdminManualOfframpRequest[];
  statuses: Array<{ status: string }>;
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
  routerTxHash?: string | null;
  tcoinOutAmount: string | null;
  finalTokenSymbol?: string | null;
  poolId?: string | null;
  reserveAssetUsed?: string | null;
  latestAttemptNo: number | null;
  latestAttemptMode: string | null;
  latestAttemptState: string | null;
  latestAttemptError: string | null;
  createdAt: string;
  updatedAt: string;
};
