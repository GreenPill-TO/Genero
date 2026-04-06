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
    const { setSessionSnapshot } = await import("@shared/lib/supabase/session");
    setSessionSnapshot(null);
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
    const { setSessionSnapshot } = await import("@shared/lib/supabase/session");
    setSessionSnapshot(null);
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

  it("reuses the cached access token when the browser session read has not settled yet", async () => {
    const { setSessionSnapshot } = await import("@shared/lib/supabase/session");
    setSessionSnapshot({ access_token: "cached-token" } as never);
    getSessionMock.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const { invokeEdgeFunction } = await import("./core");

    await invokeEdgeFunction("user-settings", "/bootstrap", {
      appContext: { citySlug: "tcoin" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer cached-token",
        }),
      })
    );
  });

  it("expands bare 404 not-found responses into a route-specific message", async () => {
    const { setSessionSnapshot } = await import("@shared/lib/supabase/session");
    setSessionSnapshot(null);
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "jwt-token" } } });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found." }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const { invokeEdgeFunction } = await import("./core");

    await expect(
      invokeEdgeFunction("onramp", "/legacy/interac/reference", {
        method: "POST",
        body: { amount: 10, refCode: "TCOIN-REF-123456" },
        appContext: { citySlug: "tcoin" },
      })
    ).rejects.toThrow("onramp route /legacy/interac/reference is not available in this environment.");
  });
});
