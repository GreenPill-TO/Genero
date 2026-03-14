/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    insertPayload: null as Record<string, unknown> | null,
    updatePayload: null as Record<string, unknown> | null,
    governancePayload: null as Record<string, unknown> | null,
  };

  return {
    state,
    isBuyEnabledMock: vi.fn(() => true),
    resolveApiAuthContextMock: vi.fn(async () => ({
      userRow: { id: 99 },
      serviceRole: {
        from: (table: string) => {
          if (table === "wallet_list") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: { public_key: "0x1111111111111111111111111111111111111111" },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === "onramp_checkout_sessions") {
            return {
              insert: (payload: Record<string, unknown>) => {
                state.insertPayload = payload;
                return {
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: "session-1",
                        metadata: {},
                        ...payload,
                      },
                      error: null,
                    }),
                  }),
                };
              },
              update: (payload: Record<string, unknown>) => {
                state.updatePayload = payload;
                return {
                  eq: async () => ({ error: null }),
                };
              },
            };
          }

          if (table === "governance_actions_log") {
            return {
              insert: (payload: Record<string, unknown>) => {
                state.governancePayload = payload;
                return Promise.resolve({ error: null });
              },
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      },
    })),
    resolveActiveAppInstanceIdMock: vi.fn(async () => 7),
    resolveCitySlugMock: vi.fn((value?: string) => value?.trim().toLowerCase() || "tcoin"),
    getOrCreateDepositWalletMock: vi.fn(async () => ({
      wallet: { address: "0x2222222222222222222222222222222222222222" },
      created: true,
      rowId: "wallet-row",
    })),
    buildTransakSessionMock: vi.fn(() => ({
      provider: "transak",
      providerSessionId: "provider-session-1",
      providerOrderId: "provider-order-1",
      widgetUrl: "https://global.transak.com?foo=bar",
      widgetConfig: { foo: "bar" },
    })),
    resolveOnrampConfigMock: vi.fn(() => ({
      targetChainId: 42220,
      targetInputAsset: "USDC",
      finalAsset: "TCOIN",
      swapAdapterId: "default",
    })),
  };
});

vi.mock("@shared/lib/onramp/feature", () => ({
  isBuyTcoinCheckoutEnabled: h.isBuyEnabledMock,
}));

vi.mock("@shared/lib/bia/apiAuth", () => ({
  resolveApiAuthContext: h.resolveApiAuthContextMock,
}));

vi.mock("@shared/lib/bia/server", () => ({
  resolveCitySlug: h.resolveCitySlugMock,
  resolveActiveAppInstanceId: h.resolveActiveAppInstanceIdMock,
  toNumber: (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  },
}));

vi.mock("@services/onramp/src", () => ({
  getOrCreateDepositWallet: h.getOrCreateDepositWalletMock,
  buildTransakSession: h.buildTransakSessionMock,
  resolveOnrampConfig: h.resolveOnrampConfigMock,
}));

import { POST } from "./route";

describe("POST /api/onramp/session", () => {
  beforeEach(() => {
    h.state.insertPayload = null;
    h.state.updatePayload = null;
    h.state.governancePayload = null;
    h.isBuyEnabledMock.mockReturnValue(true);
  });

  it("creates onramp session and returns transak widget config", async () => {
    const response = await POST(
      new Request("http://localhost/api/onramp/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          citySlug: "tcoin",
          fiatAmount: 120,
          fiatCurrency: "CAD",
          countryCode: "CA",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.sessionId).toBe("session-1");
    expect(body.provider).toBe("transak");
    expect(body.widgetUrl).toContain("transak");

    expect(h.state.insertPayload).toMatchObject({
      user_id: 99,
      app_instance_id: 7,
      city_slug: "tcoin",
      status: "created",
    });
    expect(h.state.updatePayload).toMatchObject({
      provider_session_id: "provider-session-1",
      provider_order_id: "provider-order-1",
    });
  });

  it("returns 404 when checkout feature is disabled", async () => {
    h.isBuyEnabledMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/onramp/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiatAmount: 50, fiatCurrency: "CAD" }),
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(String(body.error)).toContain("unavailable");
  });
});
