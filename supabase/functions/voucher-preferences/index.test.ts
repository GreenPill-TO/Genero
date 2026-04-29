/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const requestScopedRpcMock = vi.hoisted(() => vi.fn());
const createAuthenticatedRequestClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    rpc: requestScopedRpcMock,
  }))
);
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
  createAuthenticatedRequestClient: createAuthenticatedRequestClientMock,
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
    createAuthenticatedRequestClientMock.mockClear();
    requestScopedRpcMock.mockReset();
    voucherRoutingMocks.getVoucherCompatibilityRules.mockReset();
    voucherRoutingMocks.listMerchantsForVoucherScope.mockReset();
    voucherRoutingMocks.resolveActiveUserBiaSet.mockReset();
  });

  it("loads self-service preferences through the request-scoped RPC boundary", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: {
        citySlug: "tcoin",
        appInstanceId: 7,
        preferences: [{ id: 1, trust_status: "trusted" }],
      },
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/preferences", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(createAuthenticatedRequestClientMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "voucher preference self-service read" })
    );
    expect(requestScopedRpcMock).toHaveBeenCalledWith("edge_list_voucher_preferences_v1", {
      p_app_slug: "wallet",
      p_city_slug: "tcoin",
      p_environment: "development",
    });
    await expect(res.json()).resolves.toMatchObject({
      preferences: [{ id: 1, trust_status: "trusted" }],
    });
  });

  it("updates self-service preferences through the request-scoped RPC boundary", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: { preference: { id: 1, trust_status: "blocked" } },
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/preferences", {
        method: "PATCH",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ trustStatus: "blocked", merchantStoreId: 9, tokenAddress: "0xabc" }),
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(requestScopedRpcMock).toHaveBeenCalledWith("edge_upsert_voucher_preference_v1", {
      p_app_slug: "wallet",
      p_city_slug: "tcoin",
      p_environment: "development",
      p_merchant_store_id: 9,
      p_token_address: "0xabc",
      p_trust_status: "blocked",
    });
  });

  it("preserves unauthorized preference RPC failures as 401 responses", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", code: "42501" },
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/preferences", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("rejects empty preference RPC responses instead of returning partial payloads", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/voucher-preferences/preferences", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to load voucher preferences: empty response",
    });
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
    expect(resolveAuthenticatedUserMock).toHaveBeenCalledWith(
      expect.any(Request),
      "voucher-preferences privileged compatibility and merchant reads"
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
