import { NextResponse } from "next/server";
import { resolveSupabasePublishableKey } from "@shared/lib/supabase/env";
import {
  normaliseTransakWebhookEvent,
  verifyAndDecodeTransakWebhookPayload,
} from "@services/onramp/src";

function headerValue(req: Request, key: string): string | null {
  return req.headers.get(key) ?? req.headers.get(key.toLowerCase()) ?? req.headers.get(key.toUpperCase());
}

function resolveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  return url;
}

function resolveWebhookForwardSecret(): string {
  const secret = process.env.ONRAMP_WEBHOOK_FORWARD_SECRET?.trim();
  if (!secret) {
    throw new Error("ONRAMP_WEBHOOK_FORWARD_SECRET is required.");
  }
  return secret;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    headerValue(req, "x-transak-signature") ??
    headerValue(req, "transak-signature") ??
    headerValue(req, "x-signature");

  const verification = verifyAndDecodeTransakWebhookPayload(rawBody, signature);
  if (!verification.isValid || !verification.payload) {
    return NextResponse.json({ error: "Invalid webhook verification." }, { status: 401 });
  }

  const normalized = normaliseTransakWebhookEvent(verification.payload);
  const response = await fetch(`${resolveSupabaseUrl()}/functions/v1/onramp/webhooks/transak`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: resolveSupabasePublishableKey(),
      "x-app-slug": "wallet",
      "x-city-slug": "tcoin",
      "x-app-environment": process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "production",
      "x-onramp-forward-secret": resolveWebhookForwardSecret(),
    },
    body: JSON.stringify({
      providerEventId: normalized.providerEventId,
      providerOrderId: normalized.providerOrderId,
      providerSessionId: normalized.providerSessionId,
      eventType: normalized.eventType,
      statusHint: normalized.statusHint,
      txHash: normalized.txHash,
      payload: normalized.payload,
      signatureMode: verification.mode,
    }),
  });

  const text = await response.text();
  return new NextResponse(text || null, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
