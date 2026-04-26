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
    h.mockGetUser.mockReset();
    h.mockGetWalletStatsSummary.mockReset();
    h.mockSupabaseClient.auth.getUser = h.mockGetUser;
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
