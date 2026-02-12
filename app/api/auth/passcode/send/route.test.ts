import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/passcode/send", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a provider unavailable message when upstream fetch fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const req = new Request("http://localhost/api/auth/passcode/send", {
      method: "POST",
      body: JSON.stringify({ contact: "person@example.com", method: "email" }),
    });

    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toEqual({
      success: false,
      message: "Authentication provider is unavailable.",
    });
  });

  it("uses supabase otp endpoint with auth headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/auth/passcode/send", {
      method: "POST",
      body: JSON.stringify({ contact: "person@example.com", method: "email" }),
    });

    const response = await POST(req);
    const json = await response.json();

    expect(fetchMock).toHaveBeenCalledWith("https://example.supabase.co/auth/v1/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: "anon-key",
        Authorization: "Bearer anon-key",
      },
      body: JSON.stringify({ email: "person@example.com", create_user: true }),
    });
    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
  });
});
