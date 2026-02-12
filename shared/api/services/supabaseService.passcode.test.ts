import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPasscode, verifyPasscode } from "./supabaseService";

describe("supabase passcode service requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends passcode requests through the internal API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendPasscode({ contact: "person@example.com", method: "email" });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/passcode/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: "person@example.com", method: "email" }),
    });
  });

  it("throws a friendly error when authentication service is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPasscode({ contact: "person@example.com", method: "email" })).rejects.toThrow(
      "Unable to reach the authentication service. Please check your connection and try again."
    );
  });

  it("uses the verify endpoint for passcode verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyPasscode({ contact: "person@example.com", method: "email", passcode: "123456" });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/passcode/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: "person@example.com",
        method: "email",
        passcode: "123456",
      }),
    });
  });
});
