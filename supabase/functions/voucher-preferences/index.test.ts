/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const resolveActiveAppContextMock = vi.hoisted(() => vi.fn());
const assertAdminOrOperatorMock = vi.hoisted(() => vi.fn());
const voucherRoutingMocks = vi.hoisted(() => ({
  getVoucherCompatibilityRules: vi.fn(),
  listMerchantsForVoucherScope: vi.fn(),
  resolveActiveUserBiaSet: vi.fn(),
}));

vi.mock("npm:viem@2.23.3", () => ({
  getAddress: (value: string) => value,
  isAddress: () => true,
}));

vi.mock("../_shared/auth.ts", () => ({
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveActiveAppContext: resolveActiveAppContextMock,
  resolveAppContextInput: vi.fn(() => ({
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: "development",
  })),
}));

vi.mock("../_shared/rbac.ts", () => ({
  assertAdminOrOperator: assertAdminOrOperatorMock,
}));

vi.mock("../_shared/voucherRouting.ts", () => voucherRoutingMocks);

import { handleRequest } from "./index";

describe("voucher-preferences handleRequest", () => {
  beforeEach(() => {
    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      },
      userRow: { id: 3 },
    });
    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
    assertAdminOrOperatorMock.mockResolvedValue(undefined);
    voucherRoutingMocks.getVoucherCompatibilityRules.mockReset();
    voucherRoutingMocks.listMerchantsForVoucherScope.mockReset();
    voucherRoutingMocks.resolveActiveUserBiaSet.mockReset();
  });

  it("returns compatibility rules through the helper", async () => {
    voucherRoutingMocks.getVoucherCompatibilityRules.mockResolvedValue([{ id: "rule-1" }]);

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/compatibility?chainId=42220", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    expect(voucherRoutingMocks.getVoucherCompatibilityRules).toHaveBeenCalledWith(
      expect.objectContaining({
        citySlug: "tcoin",
        chainId: 42220,
      })
    );
  });

  it("returns merchant liquidity through the helper", async () => {
    voucherRoutingMocks.listMerchantsForVoucherScope.mockResolvedValue({
      state: "ready",
      setupMessage: null,
      merchants: [{ merchantStoreId: 9, available: true }],
    });
    voucherRoutingMocks.resolveActiveUserBiaSet.mockResolvedValue({
      primaryBiaId: "bia-1",
      secondaryBiaIds: [],
      allBiaIds: new Set(["bia-1"]),
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/merchants?scope=city&chainId=42220", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      state: "ready",
      merchants: [{ merchantStoreId: 9, available: true }],
    });
    expect(voucherRoutingMocks.listMerchantsForVoucherScope).toHaveBeenCalledWith(
      expect.objectContaining({
        citySlug: "tcoin",
        chainId: 42220,
        scope: "city",
      })
    );
  });
});
