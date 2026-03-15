import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: getSessionMock,
    },
  }),
}));

describe("invokeEdgeFunction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "pk_test";
  });

  it("omits Authorization when there is no session token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { invokeEdgeFunction } = await import("./core");

    await invokeEdgeFunction("user-requests", "/create", {
      method: "POST",
      body: { name: "Hubert", email: "hubert@example.com", message: "Hi" },
      appContext: { citySlug: "tcoin" },
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

  it("includes Authorization when a session token exists", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "jwt-token" } } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { invokeEdgeFunction } = await import("./core");

    await invokeEdgeFunction("user-requests", "/list", {
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
