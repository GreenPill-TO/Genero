/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn());
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const limitMock = vi.hoisted(() => vi.fn(async () => ({ data: [{ id: 1 }], error: null })));
const orderMock = vi.hoisted(() => vi.fn(() => ({ limit: limitMock })));
const eqMock = vi.hoisted(() => vi.fn(() => ({ order: orderMock, eq: eqMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

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

import { handleRequest } from "./index";

describe("governance handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceRoleClientMock.mockReturnValue({ from: fromMock });
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

  it("loads the action feed after scoped identity/context resolution", async () => {
    const res = await handleRequest(
      new Request("http://localhost/functions/v1/governance/actions", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeContextMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "governance scoped identity and app context" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({ purpose: "governance action feed read" });
    await expect(res.json()).resolves.toMatchObject({
      citySlug: "tcoin",
      appInstanceId: 7,
      actions: [{ id: 1 }],
    });
  });
});
