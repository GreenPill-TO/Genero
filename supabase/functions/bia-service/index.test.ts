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
const userHasAnyRoleMock = vi.hoisted(() => vi.fn());
const assertAdminOrOperatorMock = vi.hoisted(() => vi.fn());

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
  userHasAnyRole: userHasAnyRoleMock,
}));

import { handleRequest } from "./index";

describe("bia-service handleRequest", () => {
  beforeEach(() => {
    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {},
      userRow: { id: 3 },
    });
    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
    userHasAnyRoleMock.mockResolvedValue(false);
    assertAdminOrOperatorMock.mockResolvedValue(undefined);
    createAuthenticatedRequestClientMock.mockClear();
    requestScopedRpcMock.mockReset();
  });

  it("loads BIA list through the request-scoped RPC boundary", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: {
        citySlug: "tcoin",
        appInstanceId: 7,
        bias: [{ id: "bia-1", name: "Downtown" }],
        activeAffiliation: null,
        secondaryAffiliations: [],
        mappingsState: "empty",
        mappingsSetupMessage: null,
        mappings: [],
        controls: [],
        canAdminister: false,
      },
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/bia-service/list?includeMappings=true", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(createAuthenticatedRequestClientMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "BIA catalogue and current-user affiliation read" })
    );
    expect(requestScopedRpcMock).toHaveBeenCalledWith("edge_bia_list_v1", {
      p_app_slug: "wallet",
      p_city_slug: "tcoin",
      p_environment: "development",
      p_include_mappings: true,
    });
    await expect(res.json()).resolves.toMatchObject({
      bias: [{ id: "bia-1", name: "Downtown" }],
      canAdminister: false,
    });
  });

  it("loads BIA mappings through the request-scoped RPC boundary", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: {
        citySlug: "tcoin",
        chainId: 42220,
        state: "ready",
        setupMessage: null,
        canAdminister: true,
        mappings: [{ mapping_id: 1 }],
        health: { mappedPools: 1, discoveredPools: 1, unmappedPools: 0, staleMappings: 0 },
      },
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/bia-service/mappings?chainId=42220", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(requestScopedRpcMock).toHaveBeenCalledWith("edge_bia_mappings_v1", {
      p_app_slug: "wallet",
      p_city_slug: "tcoin",
      p_environment: "development",
      p_chain_id: 42220,
      p_include_health: true,
    });
  });

  it("preserves unauthorized BIA RPC failures as 401 responses", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", code: "42501" },
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/bia-service/mappings?chainId=42220", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("rejects empty BIA list RPC responses instead of returning partial payloads", async () => {
    requestScopedRpcMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/bia-service/list", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to load BIAs: empty response",
    });
  });
});
