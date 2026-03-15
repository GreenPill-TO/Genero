/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const resolveActiveAppContextMock = vi.hoisted(() => vi.fn());
const onrampMocks = vi.hoisted(() => ({
  createOnrampSession: vi.fn(),
  getOnrampSessionStatus: vi.fn(),
  markOnrampSessionAction: vi.fn(),
  retryOnrampSession: vi.fn(),
  touchOnrampSessionsForUser: vi.fn(),
  listOnrampAdminSessions: vi.fn(),
  listLegacyRampAdminRequests: vi.fn(),
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

vi.mock("../_shared/onramp.ts", () => onrampMocks);

import { handleRequest } from "./index";

describe("onramp handleRequest", () => {
  beforeEach(() => {
    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {},
      userRow: { id: 21 },
    });
    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
    Object.values(onrampMocks).forEach((mockFn) => mockFn.mockReset());
  });

  it("dispatches create session requests", async () => {
    onrampMocks.createOnrampSession.mockResolvedValue({
      status: 200,
      body: { sessionId: "session-1" },
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/onramp/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiatAmount: 25, fiatCurrency: "CAD" }),
      })
    );

    expect(res.status).toBe(200);
    expect(onrampMocks.createOnrampSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 21,
        appInstanceId: 7,
        citySlug: "tcoin",
        fiatAmount: 25,
      })
    );
  });

  it("dispatches admin request list requests", async () => {
    onrampMocks.listLegacyRampAdminRequests.mockResolvedValue({
      status: 200,
      body: { onRampRequests: [], offRampRequests: [], statuses: [] },
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/onramp/admin/requests", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    expect(onrampMocks.listLegacyRampAdminRequests).toHaveBeenCalled();
  });
});
