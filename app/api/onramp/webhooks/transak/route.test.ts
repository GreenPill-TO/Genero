/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    sessionId: "session-1",
    updatedStatus: null as Record<string, unknown> | null,
  };

  const serviceRole = {
    from: (table: string) => {
      if (table === "onramp_checkout_sessions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: state.sessionId }, error: null }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            state.updatedStatus = payload;
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "onramp_provider_events") {
        return {
          upsert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "evt-1" }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    state,
    createServiceRoleClientMock: vi.fn(() => serviceRole),
    verifySignatureMock: vi.fn(() => true),
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
    runSessionSettlementMock: vi.fn(async () => ({
      sessionId: "session-1",
      status: "mint_complete",
      skipped: false,
    })),
  };
});

vi.mock("@shared/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: h.createServiceRoleClientMock,
}));

vi.mock("@services/onramp/src", () => ({
  verifyTransakWebhookSignature: h.verifySignatureMock,
  normaliseTransakWebhookEvent: h.normalizeEventMock,
  runSessionSettlement: h.runSessionSettlementMock,
}));

import { POST } from "./route";

describe("POST /api/onramp/webhooks/transak", () => {
  beforeEach(() => {
    h.state.updatedStatus = null;
    h.verifySignatureMock.mockReturnValue(true);
  });

  it("persists event, updates session, and triggers settlement", async () => {
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
    expect(h.state.updatedStatus).toMatchObject({
      status: "crypto_sent",
      incoming_usdc_tx_hash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(h.runSessionSettlementMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid signatures", async () => {
    h.verifySignatureMock.mockReturnValue(false);

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
  });
});
