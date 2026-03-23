/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetTorontoCoinOpsStatus: vi.fn(),
  mockGetIndexerScopeStatus: vi.fn(),
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: h.mockGetUser,
    },
  }),
}));

vi.mock("@shared/lib/contracts/torontocoinOps", () => ({
  getTorontoCoinOpsStatus: h.mockGetTorontoCoinOpsStatus,
}));

vi.mock("@services/indexer/src", () => ({
  getIndexerScopeStatus: h.mockGetIndexerScopeStatus,
}));

import { GET } from "./route";

describe("GET /api/tcoin/ops/status", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockGetTorontoCoinOpsStatus.mockReset();
    h.mockGetIndexerScopeStatus.mockReset();
  });

  it("returns TorontoCoin ops health for authorised users", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    h.mockGetTorontoCoinOpsStatus.mockResolvedValue({
      addresses: { liquidityRouter: "0xrouter" },
      ownership: {},
      pools: [],
      reserveRouteHealth: {},
      artifactTimestamps: {},
    });
    h.mockGetIndexerScopeStatus.mockResolvedValue({
      torontoCoinTracking: {
        requiredTokenAddress: "0xtoken",
        cplTcoinTracked: true,
        trackedPools: [],
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.addresses.liquidityRouter).toBe("0xrouter");
    expect(body.indexer.requiredTokenAddress).toBe("0xtoken");
  });

  it("returns 401 when auth user is missing", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });
});
