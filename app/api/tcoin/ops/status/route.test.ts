/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetTorontoCoinOpsStatus: vi.fn(),
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

import { GET } from "./route";

describe("GET /api/tcoin/ops/status", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockGetTorontoCoinOpsStatus.mockReset();
  });

  it("returns TorontoCoin ops health for authorised users", async () => {
    h.mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    h.mockGetTorontoCoinOpsStatus.mockResolvedValue({
      addresses: { liquidityRouter: "0xrouter" },
      ownership: {},
      poolLiquidity: {},
      scenarioPreview: {},
      reserveRouteHealth: {},
      artifactTimestamps: {},
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.addresses.liquidityRouter).toBe("0xrouter");
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
