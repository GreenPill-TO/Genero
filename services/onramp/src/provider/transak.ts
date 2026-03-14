import crypto from "crypto";
import { resolveOnrampConfig } from "../config";
import type { CreateOnrampSessionInput, OnrampProviderEventNormalized, OnrampSessionStatus } from "../types";

export type TransakSessionBuildResult = {
  provider: "transak";
  providerSessionId: string;
  providerOrderId: string;
  widgetUrl: string;
  widgetConfig: Record<string, unknown>;
};

function mapStatusHint(raw: string): OnrampSessionStatus | null {
  const normalized = raw.trim().toLowerCase();

  if (["created", "initialized", "init"].includes(normalized)) {
    return "created";
  }
  if (["widget_opened", "opened"].includes(normalized)) {
    return "widget_opened";
  }
  if (["pending", "awaiting_payment", "payment_submitted", "payment_initiated"].includes(normalized)) {
    return "payment_submitted";
  }
  if (["processing", "crypto_sent", "crypto_processing", "order_processing"].includes(normalized)) {
    return "crypto_sent";
  }
  if (["usdc_received", "wallet_credited"].includes(normalized)) {
    return "usdc_received";
  }
  if (["mint_started"].includes(normalized)) {
    return "mint_started";
  }
  if (["completed", "success", "order_completed", "order_successful"].includes(normalized)) {
    return "crypto_sent";
  }
  if (["mint_complete"].includes(normalized)) {
    return "mint_complete";
  }
  if (["manual_review"].includes(normalized)) {
    return "manual_review";
  }
  if (["failed", "cancelled", "rejected", "expired", "error"].includes(normalized)) {
    return "failed";
  }

  return null;
}

function resolveReferrerDomain(appBaseUrl: string): string {
  try {
    return new URL(appBaseUrl).host;
  } catch {
    return "localhost";
  }
}

function extractWidgetUrl(payload: Record<string, unknown>): string | null {
  const direct = extractString(payload.widgetUrl);
  if (direct) {
    return direct;
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const nested = extractString((data as Record<string, unknown>).widgetUrl);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export async function buildTransakSession(input: CreateOnrampSessionInput & {
  sessionId: string;
  depositAddress: `0x${string}`;
}): Promise<TransakSessionBuildResult> {
  const config = resolveOnrampConfig();

  const providerSessionId = input.sessionId;
  const providerOrderId = `genero-${input.sessionId}`;
  const widgetParams: Record<string, unknown> = {
    apiKey: config.transakApiKey,
    defaultNetwork: "celo",
    defaultCryptoCurrency: config.targetInputAsset,
    cryptoCurrencyCode: config.targetInputAsset,
    network: "celo",
    walletAddress: input.depositAddress,
    disableWalletAddressForm: true,
    disableCryptoSelection: true,
    fiatAmount: input.fiatAmount,
    fiatCurrency: input.fiatCurrency.toUpperCase(),
    countryCode: (input.countryCode ?? "").toUpperCase(),
    redirectURL: `${config.appBaseUrl.replace(/\/$/, "")}/dashboard?onrampSession=${input.sessionId}`,
    partnerOrderId: providerOrderId,
    partnerCustomerId: String(input.userId),
    exchangeScreenTitle: "Buy TCOIN",
    isAutoFillUserData: true,
  };

  const response = await fetch(config.transakWidgetApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "access-token": config.transakAccessToken,
      ...(config.transakAuthorizationToken ? { authorization: config.transakAuthorizationToken } : {}),
    },
    body: JSON.stringify({
      widgetParams,
      referrerDomain: resolveReferrerDomain(config.appBaseUrl),
    }),
  });

  const responsePayload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errorMessage =
      extractString(responsePayload.message) ??
      extractString(responsePayload.error) ??
      `Transak widget URL request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const widgetUrl = extractWidgetUrl(responsePayload);
  if (!widgetUrl) {
    throw new Error("Transak widget API response did not include widgetUrl.");
  }

  return {
    provider: "transak",
    providerSessionId,
    providerOrderId,
    widgetUrl,
    widgetConfig: {
      widgetParams,
      referrerDomain: resolveReferrerDomain(config.appBaseUrl),
    },
  };
}

function extractString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function base64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function toBase64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore JSON parse errors
  }
  return null;
}

function isLikelyJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim());
}

function extractJwtCandidate(rawBody: string, parsedJson: Record<string, unknown> | null): string | null {
  const direct = rawBody.trim();
  if (isLikelyJwt(direct)) {
    return direct;
  }

  if (!parsedJson) {
    return null;
  }

  const candidates = [
    parsedJson.encryptedData,
    parsedJson.data,
    parsedJson.payload,
    parsedJson.jwt,
    parsedJson.token,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && isLikelyJwt(value)) {
      return value.trim();
    }
  }

  return null;
}

function verifyAndDecodeJwtHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSignature = toBase64Url(crypto.createHmac("sha256", secret).update(signingInput).digest());
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signaturePart);
  if (expectedBuffer.length !== actualBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payloadJson = base64UrlToBuffer(payloadPart).toString("utf8");
    const payload = JSON.parse(payloadJson) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function payloadPath(payload: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = payload;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function pickFirstString(payload: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = payloadPath(payload, path);
    const extracted = extractString(value);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

export function normaliseTransakWebhookEvent(payload: Record<string, unknown>): OnrampProviderEventNormalized {
  const eventType =
    pickFirstString(payload, [["eventType"], ["event"], ["webhookEvent"], ["status"], ["data", "status"]]) ??
    "unknown";

  const orderId = pickFirstString(payload, [
    ["orderId"],
    ["partnerOrderId"],
    ["data", "orderId"],
    ["data", "partnerOrderId"],
    ["id"],
  ]);

  const sessionId = pickFirstString(payload, [["sessionId"], ["partnerSessionId"], ["metadata", "sessionId"]]);

  const eventId = pickFirstString(payload, [["eventId"], ["id"], ["data", "eventId"]]);

  const txHash = pickFirstString(payload, [
    ["txHash"],
    ["transactionHash"],
    ["data", "txHash"],
    ["data", "transactionHash"],
  ]);

  const statusRaw =
    pickFirstString(payload, [["status"], ["eventType"], ["data", "status"], ["orderStatus"]]) ?? eventType;

  return {
    provider: "transak",
    providerEventId: eventId,
    providerOrderId: orderId,
    providerSessionId: sessionId,
    eventType,
    statusHint: mapStatusHint(statusRaw),
    txHash,
    payload,
  };
}

function constantTimeEqualsHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifyLegacyTransakWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const config = resolveOnrampConfig();
  if (!signatureHeader || !config.transakWebhookSecret) {
    return false;
  }

  const signature = signatureHeader.trim();
  const normalizedSignature = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  if (!/^[0-9a-fA-F]+$/.test(normalizedSignature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.transakWebhookSecret)
    .update(rawBody)
    .digest("hex");

  return constantTimeEqualsHex(expected.toLowerCase(), normalizedSignature.toLowerCase());
}

export type TransakWebhookVerificationResult = {
  isValid: boolean;
  payload: Record<string, unknown> | null;
  mode: "jwt_access_token" | "legacy_hmac" | "none";
};

export function verifyAndDecodeTransakWebhookPayload(
  rawBody: string,
  signatureHeader: string | null
): TransakWebhookVerificationResult {
  const config = resolveOnrampConfig();
  const parsedJson = tryParseJsonObject(rawBody);
  const jwtCandidate = extractJwtCandidate(rawBody, parsedJson);

  if (jwtCandidate) {
    const decodedJwtPayload = verifyAndDecodeJwtHs256(jwtCandidate, config.transakAccessToken);
    if (decodedJwtPayload) {
      return {
        isValid: true,
        payload: decodedJwtPayload,
        mode: "jwt_access_token",
      };
    }
  }

  if (verifyLegacyTransakWebhookSignature(rawBody, signatureHeader)) {
    return {
      isValid: true,
      payload: parsedJson,
      mode: "legacy_hmac",
    };
  }

  return {
    isValid: false,
    payload: null,
    mode: "none",
  };
}
