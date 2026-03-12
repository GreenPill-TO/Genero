export type OnrampProvider = "transak";

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

export type OnrampAttemptMode = "auto" | "manual_operator";
export type OnrampAttemptState = "started" | "succeeded" | "failed";

export type OnrampCheckoutSessionRow = {
  id: string;
  user_id: number;
  app_instance_id: number;
  city_slug: string;
  provider: OnrampProvider;
  provider_session_id: string | null;
  provider_order_id: string | null;
  fiat_currency: string;
  fiat_amount: string | number;
  country_code: string | null;
  target_chain_id: number;
  target_input_asset: string;
  final_asset: string;
  deposit_address: string;
  recipient_wallet: string;
  status: OnrampSessionStatus;
  status_reason: string | null;
  incoming_usdc_tx_hash: string | null;
  mint_tx_hash: string | null;
  tcoin_delivery_tx_hash: string | null;
  usdc_received_amount: string | number | null;
  tcoin_out_amount: string | number | null;
  requested_charity_id: number | null;
  quote_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OnrampProviderEventNormalized = {
  provider: OnrampProvider;
  providerEventId: string | null;
  providerOrderId: string | null;
  providerSessionId: string | null;
  eventType: string;
  statusHint: OnrampSessionStatus | null;
  txHash: string | null;
  payload: Record<string, unknown>;
};

export type OnrampSessionTimelineStep = {
  key: OnrampSessionStatus;
  label: string;
  reached: boolean;
  active: boolean;
};

export type OnrampStatusProjection = {
  id: string;
  status: OnrampSessionStatus;
  statusReason: string | null;
  provider: OnrampProvider;
  fiatCurrency: string;
  fiatAmount: string;
  inputAsset: string;
  finalAsset: string;
  depositAddress: string;
  recipientWallet: string;
  incomingUsdcTxHash: string | null;
  mintTxHash: string | null;
  tcoinDeliveryTxHash: string | null;
  usdcReceivedAmount: string | null;
  tcoinOutAmount: string | null;
  timeline: OnrampSessionTimelineStep[];
  createdAt: string;
  updatedAt: string;
};

export type CreateOnrampSessionInput = {
  userId: number;
  appInstanceId: number;
  citySlug: string;
  fiatAmount: number;
  fiatCurrency: string;
  countryCode?: string | null;
  recipientWallet: `0x${string}`;
};
