/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockSupabaseClient: {
    auth: {
      getUser: vi.fn(),
    },
  },
  mockGetUser: vi.fn(),
  mockGetWalletStatsSummary: vi.fn(),
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => h.mockSupabaseClient,
}));

vi.mock("@shared/lib/walletStats/server", () => ({
  getWalletStatsSummary: h.mockGetWalletStatsSummary,
}));

import { GET } from "./route";

describe("GET /api/tcoin/stats/summary", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-mainnet";
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "production";
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    h.mockGetUser.mockReset();
    h.mockGetWalletStatsSummary.mockReset();
    h.mockSupabaseClient.auth.getUser = h.mockGetUser;
  });

  it("rejects Preview before auth or mainnet stats reads", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "development";
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-sepolia-pay-link";
    const response = await GET();
    expect(response.status).toBe(409);
    expect(h.mockGetUser).not.toHaveBeenCalled();
    expect(h.mockGetWalletStatsSummary).not.toHaveBeenCalled();
  });

  it("rejects staging with a missing target before auth or stats reads", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "staging";
    delete process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET;
    const response = await GET();
    expect(response.status).toBe(409);
    expect(h.mockGetUser).not.toHaveBeenCalled();
    expect(h.mockGetWalletStatsSummary).not.toHaveBeenCalled();
  });

  it("returns the aggregated stats summary for any authenticated user", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    h.mockGetWalletStatsSummary.mockResolvedValue({
      generatedAt: "2026-04-03T12:00:00.000Z",
      overview: { walletCount: 8 },
      timeseries: {},
      breakdowns: {},
      ops: {},
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      overview: { walletCount: 8 },
    });
    expect(h.mockGetWalletStatsSummary).toHaveBeenCalledWith(h.mockSupabaseClient);
  });

  it("returns 401 when there is no authenticated user", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 500 when the summary loader throws", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    h.mockGetWalletStatsSummary.mockRejectedValue(new Error("summary exploded"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "summary exploded" });
  });
});
