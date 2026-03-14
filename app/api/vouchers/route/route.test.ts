/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockResolveApiAuthContext: vi.fn(),
  mockResolveActiveAppInstanceId: vi.fn(),
  mockGetActiveCityContracts: vi.fn(),
  mockResolveVoucherRouteQuote: vi.fn(),
  mockTokenDecimalsMaybeSingle: vi.fn(),
  mockWalletMaybeSingle: vi.fn(),
}));

vi.mock("@shared/lib/bia/apiAuth", () => ({
  resolveApiAuthContext: h.mockResolveApiAuthContext,
}));

vi.mock("@shared/lib/bia/server", () => ({
  resolveCitySlug: (value?: string) => value?.trim().toLowerCase() || "tcoin",
  resolveActiveAppInstanceId: h.mockResolveActiveAppInstanceId,
  toNumber: (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  },
}));

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: h.mockGetActiveCityContracts,
}));

vi.mock("@shared/lib/vouchers/routing", () => ({
  resolveVoucherRouteQuote: h.mockResolveVoucherRouteQuote,
}));

import { GET } from "./route";

describe("GET /api/vouchers/route", () => {
  beforeEach(() => {
    h.mockResolveApiAuthContext.mockReset();
    h.mockResolveActiveAppInstanceId.mockReset();
    h.mockGetActiveCityContracts.mockReset();
    h.mockResolveVoucherRouteQuote.mockReset();
    h.mockTokenDecimalsMaybeSingle.mockReset();
    h.mockWalletMaybeSingle.mockReset();

    h.mockTokenDecimalsMaybeSingle.mockResolvedValue({
      data: { token_decimals: 6 },
      error: null,
    });
    h.mockWalletMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    h.mockResolveApiAuthContext.mockResolvedValue({
      serviceRole: {
        schema: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: h.mockTokenDecimalsMaybeSingle,
                  }),
                }),
              }),
            }),
          }),
        }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: h.mockWalletMaybeSingle,
                  }),
                }),
              }),
            }),
          }),
        }),
      },
      userRow: { id: 42 },
    });

    h.mockResolveActiveAppInstanceId.mockResolvedValue(12);
    h.mockGetActiveCityContracts.mockResolvedValue({
      chainId: 42220,
      contracts: {
        TCOIN: "0x298A698031e2fD7D8F0c830F3FD887601b40058C",
      },
    });
  });

  it("returns voucher route quote for eligible merchant payment", async () => {
    h.mockResolveVoucherRouteQuote.mockResolvedValue({
      mode: "voucher",
      reason: "Voucher route selected for merchant payment.",
      citySlug: "tcoin",
      chainId: 42220,
      recipientWallet: "0x1111111111111111111111111111111111111111",
      merchantStoreId: 9,
      poolAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x3333333333333333333333333333333333333333",
      amountInTcoin: "10.000000",
      expectedVoucherOut: "10.000000",
      minVoucherOut: "9.900000",
      slippageBps: 100,
      guardDecisions: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/vouchers/route?citySlug=tcoin&amount=10&recipientWallet=0x1111111111111111111111111111111111111111"
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.quote.mode).toBe("voucher");
    expect(body.quote.poolAddress).toBe("0x2222222222222222222222222222222222222222");
    expect(h.mockResolveVoucherRouteQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        appInstanceId: 12,
        amountInTcoin: 10,
      })
    );
  });

  it("returns 400 when recipient wallet cannot be resolved", async () => {
    const response = await GET(new Request("http://localhost/api/vouchers/route?citySlug=tcoin&amount=10"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(String(body.error)).toContain("recipientWallet");
    expect(h.mockResolveVoucherRouteQuote).not.toHaveBeenCalled();
  });
});
