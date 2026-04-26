/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServiceRoleClient: vi.fn(),
  mockIsLocalOrDevelopmentEnvironment: vi.fn(),
  mockRunIndexerTouch: vi.fn(),
  serviceRoleClient: { from: vi.fn() },
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: h.mockGetUser,
    },
  }),
}));

vi.mock("@shared/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: h.mockCreateServiceRoleClient,
}));

vi.mock("@shared/lib/bia/apiAuth", () => ({
  isLocalOrDevelopmentEnvironment: h.mockIsLocalOrDevelopmentEnvironment,
}));

vi.mock("@services/indexer/src", () => ({
  runIndexerTouch: h.mockRunIndexerTouch,
}));

import { POST } from "./route";

describe("POST /api/indexer/touch", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockCreateServiceRoleClient.mockReset();
    h.mockIsLocalOrDevelopmentEnvironment.mockReset();
    h.mockRunIndexerTouch.mockReset();
    h.mockCreateServiceRoleClient.mockReturnValue(h.serviceRoleClient);
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
  });

  it("requires an authenticated user outside local/development environments", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(new Request("http://localhost/api/indexer/touch", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
    expect(h.mockCreateServiceRoleClient).not.toHaveBeenCalled();
    expect(h.mockRunIndexerTouch).not.toHaveBeenCalled();
  });

  it("rejects city scopes other than the configured city", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });

    const response = await POST(
      new Request("http://localhost/api/indexer/touch", {
        method: "POST",
        body: JSON.stringify({ citySlug: "othercoin" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Indexer touch only supports the configured city scope "tcoin".',
    });
    expect(h.mockCreateServiceRoleClient).not.toHaveBeenCalled();
    expect(h.mockRunIndexerTouch).not.toHaveBeenCalled();
  });

  it("runs the service-role touch only for the configured city scope", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    h.mockRunIndexerTouch.mockResolvedValue({
      scopeKey: "tcoin:42220",
      started: true,
      skipped: false,
      runStatus: "success",
    });

    const response = await POST(
      new Request("http://localhost/api/indexer/touch", {
        method: "POST",
        body: JSON.stringify({ citySlug: "tcoin" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scopeKey: "tcoin:42220",
      runStatus: "success",
    });
    expect(h.mockRunIndexerTouch).toHaveBeenCalledWith({
      supabase: h.serviceRoleClient,
      citySlug: "tcoin",
    });
  });

  it("redacts service-role configuration errors", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(true);
    h.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    h.mockCreateServiceRoleClient.mockImplementation(() => {
      throw new Error("Missing required env var SUPABASE_SERVICE_ROLE_KEY");
    });

    const response = await POST(new Request("http://localhost/api/indexer/touch", { method: "POST" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Indexer touch is not configured for this environment.",
    });
  });
});
