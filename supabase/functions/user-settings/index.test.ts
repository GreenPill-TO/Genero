/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ serviceRole: true })));
const resolveAuthenticatedEdgeAuthUserMock = vi.hoisted(() => vi.fn());
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const resolveEdgeAppContextMock = vi.hoisted(() => vi.fn());
const userSettingsMocks = vi.hoisted(() => ({
  clearPendingPaymentIntent: vi.fn(),
  completeSignup: vi.fn(),
  ensureAuthenticatedUserRecord: vi.fn(),
  getLegacyCubidData: vi.fn(),
  getUserSettingsBootstrap: vi.fn(),
  getWalletCustodyMaterial: vi.fn(),
  listPersonas: vi.fn(),
  registerWalletCustody: vi.fn(),
  resetSignup: vi.fn(),
  savePendingPaymentIntent: vi.fn(),
  saveSignupStep: vi.fn(),
  startSignup: vi.fn(),
  updateLegacyCubidData: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("../_shared/auth.ts", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
  resolveAuthenticatedEdgeAuthUser: resolveAuthenticatedEdgeAuthUserMock,
  resolveAuthenticatedEdgeContext: resolveAuthenticatedEdgeContextMock,
  resolveEdgeAppContext: resolveEdgeAppContextMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveAppContextInput: vi.fn(() => ({
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: "development",
  })),
}));

vi.mock("../_shared/userSettings.ts", () => userSettingsMocks);

import { handleRequest } from "./index";

describe("user-settings handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedEdgeAuthUserMock.mockResolvedValue({
      scopedClient: { scoped: true },
      authUser: { id: "auth-user-1", email: "person@example.test", phone: null },
    });
    resolveEdgeAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
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

  it("ensures users through request-scoped auth before the privileged reconciliation write", async () => {
    userSettingsMocks.ensureAuthenticatedUserRecord.mockResolvedValue({
      created: false,
      user: { id: 42 },
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/user-settings/auth/ensure-user", {
        method: "POST",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ authMethod: "email", fullContact: "person@example.test" }),
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeAuthUserMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "user-settings ensure-user scoped auth" })
    );
    expect(resolveEdgeAppContextMock).toHaveBeenCalledWith(
      { scoped: true },
      expect.objectContaining({ appSlug: "wallet", citySlug: "tcoin", environment: "development" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({
      purpose: "user-settings /auth/ensure-user operation",
    });
    expect(userSettingsMocks.ensureAuthenticatedUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        authUser: expect.objectContaining({ id: "auth-user-1" }),
        appContext: expect.objectContaining({ appInstanceId: 7 }),
      })
    );
    expect(resolveAuthenticatedEdgeContextMock).not.toHaveBeenCalled();
  });
});
