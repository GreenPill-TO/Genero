import type { OnrampCheckoutSessionRow, OnrampSessionStatus, OnrampSessionTimelineStep, OnrampStatusProjection } from "./types";

const TIMELINE_ORDER: OnrampSessionStatus[] = [
  "created",
  "widget_opened",
  "payment_submitted",
  "crypto_sent",
  "usdc_received",
  "mint_started",
  "mint_complete",
];

const STEP_LABELS: Record<OnrampSessionStatus, string> = {
  created: "Session created",
  widget_opened: "Checkout opened",
  payment_submitted: "Payment submitted",
  crypto_sent: "USDC transfer initiated",
  usdc_received: "USDC received",
  mint_started: "Router buy in progress",
  mint_complete: "cplTCOIN delivered",
  failed: "Failed",
  manual_review: "Manual review",
};

function toStringNumber(value: string | number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

export function buildOnrampTimeline(status: OnrampSessionStatus): OnrampSessionTimelineStep[] {
  const currentIndex = TIMELINE_ORDER.indexOf(status);

  return TIMELINE_ORDER.map((key, index) => ({
    key,
    label: STEP_LABELS[key],
    reached: currentIndex >= index,
    active: key === status,
  }));
}

export function projectOnrampStatus(session: OnrampCheckoutSessionRow): OnrampStatusProjection {
  const metadata = session.metadata ?? {};
  const finalTokenDecimals =
    typeof metadata.finalTokenDecimals === "number" && Number.isFinite(metadata.finalTokenDecimals)
      ? metadata.finalTokenDecimals
      : null;
  const finalTokenAddress =
    typeof metadata.finalTokenAddress === "string" ? metadata.finalTokenAddress : null;
  const finalTokenSymbol =
    typeof metadata.finalTokenSymbol === "string" ? metadata.finalTokenSymbol : null;
  const poolId = typeof metadata.poolId === "string" ? metadata.poolId : null;
  const reserveAssetUsed =
    typeof metadata.reserveAssetUsed === "string" ? metadata.reserveAssetUsed : null;
  const routerTxHash =
    typeof metadata.routerTxHash === "string" ? metadata.routerTxHash : session.mint_tx_hash;

  return {
    id: session.id,
    status: session.status,
    statusReason: session.status_reason,
    provider: session.provider,
    fiatCurrency: session.fiat_currency,
    fiatAmount: String(session.fiat_amount),
    inputAsset: session.target_input_asset,
    finalAsset: session.final_asset,
    depositAddress: session.deposit_address,
    recipientWallet: session.recipient_wallet,
    incomingUsdcTxHash: session.incoming_usdc_tx_hash,
    mintTxHash: session.mint_tx_hash,
    routerTxHash,
    tcoinDeliveryTxHash: session.tcoin_delivery_tx_hash,
    usdcReceivedAmount: toStringNumber(session.usdc_received_amount),
    tcoinOutAmount: toStringNumber(session.tcoin_out_amount),
    finalTokenAddress,
    finalTokenSymbol,
    finalTokenDecimals,
    poolId,
    reserveAssetUsed,
    timeline: buildOnrampTimeline(session.status),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}
