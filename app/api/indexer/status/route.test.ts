/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetIndexerScopeStatus: vi.fn(),
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: h.mockGetUser,
    },
  }),
}));

vi.mock("@services/indexer/src", () => ({
  getIndexerScopeStatus: h.mockGetIndexerScopeStatus,
}));

import { GET } from "./route";

describe("GET /api/indexer/status", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockGetIndexerScopeStatus.mockReset();
  });

  it("returns indexer scope status including biaSummary", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

    h.mockGetIndexerScopeStatus.mockResolvedValue({
      scopeKey: "tcoin:42220",
      citySlug: "tcoin",
      chainId: 42220,
      runControl: {
        lastStartedAt: "2026-03-10T12:00:00.000Z",
        lastCompletedAt: "2026-03-10T12:01:00.000Z",
        lastStatus: "success",
        lastError: null,
        nextEligibleStartAt: "2026-03-10T12:06:00.000Z",
        nextEligibleCompleteAt: "2026-03-10T12:06:00.000Z",
        updatedAt: "2026-03-10T12:01:00.000Z",
      },
      checkpoints: [{ source: "rpc", lastBlock: 123, lastTxHash: null, updatedAt: "2026-03-10T12:01:00.000Z" }],
      activePoolCount: 2,
      activeTokenCount: 3,
      biaSummary: {
        activeBias: 4,
        mappedPools: 2,
        unmappedPools: 1,
        staleMappings: 1,
        lastActivityByBia: [
          {
            biaId: "bia-1",
            biaCode: "DTN",
            biaName: "Downtown",
            lastIndexedBlock: 123,
            indexedEventCount: 9,
          },
        ],
      },
    });

    const response = await GET(new Request("http://localhost/api/indexer/status?citySlug=tcoin"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.biaSummary).toBeTruthy();
    expect(body.biaSummary.activeBias).toBe(4);
    expect(body.biaSummary.unmappedPools).toBe(1);
    expect(body.biaSummary.lastActivityByBia).toHaveLength(1);
    expect(h.mockGetIndexerScopeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ citySlug: "tcoin" })
    );
  });

  it("returns 401 when auth user is missing", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(new Request("http://localhost/api/indexer/status"));
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(h.mockGetIndexerScopeStatus).not.toHaveBeenCalled();
  });
});
