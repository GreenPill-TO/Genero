/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  verifyWebhookMock: vi.fn(() => ({
    isValid: true,
    payload: { eventType: "ORDER_COMPLETED" },
    mode: "jwt_access_token",
  })),
  normalizeEventMock: vi.fn(() => ({
    provider: "transak",
    providerEventId: "evt-1",
    providerOrderId: "provider-order-1",
    providerSessionId: null,
    eventType: "ORDER_COMPLETED",
    statusHint: "crypto_sent",
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    payload: { foo: "bar" },
  })),
  fetchMock: vi.fn(),
}));

vi.mock("@services/onramp/src", () => ({
  verifyAndDecodeTransakWebhookPayload: h.verifyWebhookMock,
  normaliseTransakWebhookEvent: h.normalizeEventMock,
}));

import { POST } from "./route";

describe("POST /api/onramp/webhooks/transak", () => {
  beforeEach(() => {
    h.verifyWebhookMock.mockReturnValue({
      isValid: true,
      payload: { eventType: "ORDER_COMPLETED" },
      mode: "jwt_access_token",
    } as any);
    h.fetchMock.mockReset();
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, matchedSession: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", h.fetchMock);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "publishable-key";
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "test";
    process.env.ONRAMP_WEBHOOK_FORWARD_SECRET = "forward-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ONRAMP_WEBHOOK_FORWARD_SECRET;
  });

  it("forwards verified webhook payloads to the onramp edge function", async () => {
    const response = await POST(
      new Request("http://localhost/api/onramp/webhooks/transak", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-transak-signature": "sha256=abc",
        },
        body: JSON.stringify({ eventType: "ORDER_COMPLETED" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.matchedSession).toBe(true);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect(h.fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/onramp/webhooks/transak",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          apikey: "publishable-key",
          "x-app-slug": "wallet",
          "x-city-slug": "tcoin",
          "x-app-environment": "test",
          "x-onramp-forward-secret": "forward-secret",
        }),
        body: JSON.stringify({
          providerEventId: "evt-1",
          providerOrderId: "provider-order-1",
          providerSessionId: null,
          eventType: "ORDER_COMPLETED",
          statusHint: "crypto_sent",
          txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          payload: { foo: "bar" },
          signatureMode: "jwt_access_token",
        }),
      })
    );
  });

  it("rejects invalid signatures", async () => {
    h.verifyWebhookMock.mockReturnValue({
      isValid: false,
      payload: null,
      mode: "none",
    } as any);

    const response = await POST(
      new Request("http://localhost/api/onramp/webhooks/transak", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-transak-signature": "sha256=abc",
        },
        body: JSON.stringify({ eventType: "ORDER_COMPLETED" }),
      })
    );

    expect(response.status).toBe(401);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });
});
