/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn());
const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const resolveActiveAppContextMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const orderMock = vi.hoisted(() => vi.fn(() => ({ limit: vi.fn() })));
const eqMock = vi.hoisted(() => vi.fn(() => ({ order: orderMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === "user_requests") {
      return {
        insert: insertMock,
        select: selectMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  })
);

vi.mock("../_shared/auth.ts", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveActiveAppContext: resolveActiveAppContextMock,
  resolveAppContextInput: vi.fn((req: Request, body?: Record<string, unknown> | null) => ({
    appSlug:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).appSlug === "string"
        ? ((body.appContext as Record<string, unknown>).appSlug as string)
        : req.headers.get("x-app-slug")) ?? "wallet",
    citySlug:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).citySlug === "string"
        ? ((body.appContext as Record<string, unknown>).citySlug as string)
        : req.headers.get("x-city-slug")) ?? "tcoin",
    environment:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).environment === "string"
        ? ((body.appContext as Record<string, unknown>).environment as string)
        : req.headers.get("x-app-environment")) ?? "development",
  })),
}));

vi.mock("../_shared/rbac.ts", () => ({
  userHasAnyRole: vi.fn(),
}));

import { handleRequest } from "./index";

describe("user-requests handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createServiceRoleClientMock.mockReturnValue({
      from: fromMock,
    });

    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {
        from: fromMock,
      },
      userRow: { id: 1001 },
    });

    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });

    insertMock.mockResolvedValue({ error: null });
  });

  it("rejects malformed create payloads before inserting", async () => {
    const response = await handleRequest(
      new Request("http://localhost/functions/v1/user-requests/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app-slug": "wallet",
          "x-city-slug": "tcoin",
          "x-app-environment": "development",
        },
        body: JSON.stringify({
          email: "hubert@example.com",
          message: "Need help",
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Name is required.",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates a user request when the payload is valid", async () => {
    const response = await handleRequest(
      new Request("http://localhost/functions/v1/user-requests/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10, 70.41.3.18",
          "x-app-slug": "wallet",
          "x-city-slug": "tcoin",
          "x-app-environment": "development",
        },
        body: JSON.stringify({
          name: "  Hubert Cormac  ",
          email: "Hubert.Cormac@Example.com",
          message: "  Please call me back. ",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(insertMock).toHaveBeenCalledWith({
      name: "Hubert Cormac",
      email: "hubert.cormac@example.com",
      message: "Please call me back.",
      ip_addresses: ["203.0.113.10"],
      app_instance_id: 7,
    });
  });
});
