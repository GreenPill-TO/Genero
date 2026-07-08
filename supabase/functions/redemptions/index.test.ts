/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ serviceRole: true })));
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const redemptionMocks = vi.hoisted(() => ({
  approveRedemption: vi.fn(),
  createLegacyOfframpRequest: vi.fn(),
  createRedemptionRequest: vi.fn(),
  listRedemptionRequests: vi.fn(),
  settleRedemption: vi.fn(),
  updateLegacyOfframpAdminRequest: vi.fn(),
}));

vi.mock("../_shared/auth.ts", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
  resolveAuthenticatedEdgeContext: resolveAuthenticatedEdgeContextMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveAppContextInput: vi.fn(() => ({
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: "development",
  })),
}));

vi.mock("../_shared/redemptions.ts", () => redemptionMocks);

import { handleRequest } from "./index";

describe("redemptions handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedEdgeContextMock.mockResolvedValue({
      scopedClient: {},
      userRow: { id: 42 },
      appContext: {
        appSlug: "wallet",
        citySlug: "tcoin",
        environment: "development",
        appInstanceId: 7,
      },
    });
  });

  it("dispatches redemption requests through a route-specific service-role boundary", async () => {
    redemptionMocks.createRedemptionRequest.mockResolvedValue({ id: "redemption-1" });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/redemptions/request", {
        method: "POST",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ amount: 10 }),
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeContextMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "redemptions scoped identity and app context" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({ purpose: "redemptions /request operation" });
    expect(redemptionMocks.createRedemptionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        appContext: expect.objectContaining({ appInstanceId: 7 }),
      })
    );
  });
});
