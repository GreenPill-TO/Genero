/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getSession: getSessionMock,
    },
  }),
}));

describe("proxyEdgeRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
  });

  it("omits Authorization for public proxy calls without a session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { proxyEdgeRequest } = await import("./serverProxy");

    await proxyEdgeRequest({
      req: new Request("http://localhost/api/user_requests", { method: "POST" }),
      functionName: "user-requests",
      path: "/create",
      method: "POST",
      body: { name: "Hubert", email: "hubert@example.com", message: "Hi" },
      appContext: { citySlug: "tcoin" },
      requireAuth: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      })
    );
  });

  it("includes Authorization for authenticated proxy calls", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "jwt-token" } } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { proxyEdgeRequest } = await import("./serverProxy");

    await proxyEdgeRequest({
      req: new Request("http://localhost/api/onramp/session", { method: "GET" }),
      functionName: "onramp",
      path: "/session/1",
      appContext: { citySlug: "tcoin" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      })
    );
  });
});
