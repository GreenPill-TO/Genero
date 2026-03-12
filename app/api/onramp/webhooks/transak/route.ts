import { NextResponse } from "next/server";
import {
  normaliseTransakWebhookEvent,
  runSessionSettlement,
  verifyAndDecodeTransakWebhookPayload,
} from "@services/onramp/src";
import { createServiceRoleClient } from "@shared/lib/supabase/serviceRole";

function headerValue(req: Request, key: string): string | null {
  return req.headers.get(key) ?? req.headers.get(key.toLowerCase()) ?? req.headers.get(key.toUpperCase());
}

async function resolveSessionId(serviceRole: any, normalizedEvent: ReturnType<typeof normaliseTransakWebhookEvent>) {
  if (normalizedEvent.providerOrderId) {
    const byOrder = await serviceRole
      .from("onramp_checkout_sessions")
      .select("id")
      .eq("provider", "transak")
      .eq("provider_order_id", normalizedEvent.providerOrderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byOrder.data?.id) {
      return String(byOrder.data.id);
    }
  }

  if (normalizedEvent.providerSessionId) {
    const bySession = await serviceRole
      .from("onramp_checkout_sessions")
      .select("id")
      .eq("provider", "transak")
      .eq("provider_session_id", normalizedEvent.providerSessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bySession.data?.id) {
      return String(bySession.data.id);
    }
  }

  return null;
}

export async function POST(req: Request) {
  const serviceRole = createServiceRoleClient();
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
  const sessionId = await resolveSessionId(serviceRole, normalized);

  const insertEventResult = await serviceRole
    .from("onramp_provider_events")
    .upsert(
      {
        session_id: sessionId,
        provider: "transak",
        provider_event_id: normalized.providerEventId,
        event_type: normalized.eventType,
        payload: normalized.payload,
        signature_valid: verification.mode !== "none",
      },
      {
        onConflict: "provider,provider_event_id",
        ignoreDuplicates: true,
      }
    )
    .select("id")
    .maybeSingle();

  if (insertEventResult.error) {
    return NextResponse.json(
      { error: `Failed to persist webhook event: ${insertEventResult.error.message}` },
      { status: 500 }
    );
  }

  if (!sessionId) {
    return NextResponse.json({ ok: true, matchedSession: false });
  }

  const updatePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (normalized.statusHint) {
    updatePatch.status = normalized.statusHint;
  }

  if (normalized.txHash) {
    updatePatch.incoming_usdc_tx_hash = normalized.txHash;
  }

  const updateResult = await serviceRole
    .from("onramp_checkout_sessions")
    .update(updatePatch)
    .eq("id", sessionId);

  if (updateResult.error) {
    return NextResponse.json(
      { error: `Failed to update onramp session from webhook: ${updateResult.error.message}` },
      { status: 500 }
    );
  }

  let settlementResult: unknown = null;
  if (["crypto_sent", "usdc_received", "mint_started", "mint_complete"].includes(normalized.statusHint ?? "")) {
    settlementResult = await runSessionSettlement({
      supabase: serviceRole,
      sessionId,
      mode: "auto",
      trigger: "webhook",
      actorUserId: null,
    });
  }

  return NextResponse.json({
    ok: true,
    matchedSession: true,
    sessionId,
    settlementResult,
  });
}
