export type OnrampSessionStatus =
  | "created"
  | "widget_opened"
  | "payment_submitted"
  | "crypto_sent"
  | "usdc_received"
  | "mint_started"
  | "mint_complete"
  | "failed"
  | "manual_review";

export type OnrampSessionTimelineStep = {
  key: OnrampSessionStatus;
  label: string;
  reached: boolean;
  active: boolean;
};

export type OnrampCheckoutSession = {
  id: string;
  status: OnrampSessionStatus;
  statusReason: string | null;
  provider: "transak";
  fiatCurrency: string;
  fiatAmount: string;
  inputAsset: string;
  finalAsset: string;
  depositAddress: `0x${string}`;
  recipientWallet: `0x${string}`;
  incomingUsdcTxHash: `0x${string}` | null;
  mintTxHash: `0x${string}` | null;
  tcoinDeliveryTxHash: `0x${string}` | null;
  usdcReceivedAmount: string | null;
  tcoinOutAmount: string | null;
  timeline: OnrampSessionTimelineStep[];
  createdAt: string;
  updatedAt: string;
};

export type CreateOnrampSessionRequest = {
  citySlug?: string;
  fiatAmount: number;
  fiatCurrency: string;
  countryCode?: string;
};

export type CreateOnrampSessionResponse = {
  sessionId: string;
  provider: "transak";
  status: OnrampSessionStatus;
  depositAddress: `0x${string}`;
  recipientWallet: `0x${string}`;
  widgetUrl: string;
  widgetConfig: Record<string, string>;
};

export type OnrampStatusResponse = {
  session: OnrampCheckoutSession;
};

export type OnrampAdminSessionSummary = {
  id: string;
  userId: number;
  provider: string;
  fiatAmount: string;
  fiatCurrency: string;
  status: OnrampSessionStatus;
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
