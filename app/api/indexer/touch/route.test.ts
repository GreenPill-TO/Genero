/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockIsLocalOrDevelopmentEnvironment: vi.fn(),
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: h.mockGetUser,
    },
    rpc: h.mockRpc,
  }),
}));

vi.mock("@shared/lib/bia/apiAuth", () => ({
  isLocalOrDevelopmentEnvironment: h.mockIsLocalOrDevelopmentEnvironment,
}));

import { POST } from "./route";

describe("POST /api/indexer/touch", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockRpc.mockReset();
    h.mockIsLocalOrDevelopmentEnvironment.mockReset();
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    process.env.INDEXER_CHAIN_ID = "42220";
  });

  it("requires an authenticated user outside local/development environments", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(new Request("http://localhost/api/indexer/touch", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
    expect(h.mockRpc).not.toHaveBeenCalled();
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
    expect(h.mockRpc).not.toHaveBeenCalled();
  });

  it("queues an accepted request through the public RPC", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    h.mockRpc.mockResolvedValue({
      data: {
        scopeKey: "tcoin:42220",
        runStatus: "queued",
        queued: true,
        skipped: false,
        requestId: 12,
        requestedAt: "2026-04-26T12:00:00.000Z",
      },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/indexer/touch", {
        method: "POST",
        body: JSON.stringify({ citySlug: "tcoin" }),
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      scopeKey: "tcoin:42220",
      started: true,
      queued: true,
      skipped: false,
      runStatus: "queued",
      requestId: 12,
    });
    expect(h.mockRpc).toHaveBeenCalledWith("request_indexer_touch_v1", {
      p_city_slug: "tcoin",
      p_chain_id: 42220,
      p_source: "next-api",
    });
  });

  it("returns skipped queue metadata when a request is already queued", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    h.mockRpc.mockResolvedValue({
      data: {
        scopeKey: "othercoin:12345",
        runStatus: "queued",
        queued: false,
        skipped: true,
        reason: "already_queued",
        requestId: 42,
        requestedAt: "2026-04-26T12:01:00.000Z",
      },
      error: null,
    });
    process.env.NEXT_PUBLIC_CITYCOIN = "othercoin";
    process.env.INDEXER_CHAIN_ID = "12345";

    const response = await POST(new Request("http://localhost/api/indexer/touch", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scopeKey: "othercoin:12345",
      started: false,
      queued: false,
      skipped: true,
      reason: "already_queued",
      runStatus: "queued",
      requestId: 42,
    });
  });

  it("redacts Supabase client configuration errors", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(true);
    h.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    h.mockRpc.mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));

    const response = await POST(new Request("http://localhost/api/indexer/touch", { method: "POST" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Indexer touch is not configured for this environment.",
    });
  });
});
