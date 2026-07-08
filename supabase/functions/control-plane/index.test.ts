/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ serviceRole: true })));
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const userHasAnyRoleMock = vi.hoisted(() => vi.fn());

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

vi.mock("../_shared/rbac.ts", () => ({
  userHasAnyRole: userHasAnyRoleMock,
}));

import { handleRequest } from "./index";

describe("control-plane handleRequest", () => {
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
    userHasAnyRoleMock.mockResolvedValue(true);
  });

  it("uses scoped identity/context before the privileged role check", async () => {
    const res = await handleRequest(
      new Request("http://localhost/functions/v1/control-plane/access", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeContextMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "control-plane scoped identity and app context" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({ purpose: "control-plane access role check" });
    expect(userHasAnyRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        appInstanceId: 7,
        roles: ["admin", "operator"],
      })
    );
  });
});
