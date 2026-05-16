/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/verify_otp", () => {
  beforeEach(() => {
    h.fetchMock.mockReset();
    vi.stubGlobal("fetch", h.fetchMock);
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
  });

  it("rejects invalid phone numbers or passcodes", async () => {
    const response = await POST(
      new Request("http://localhost/api/verify_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234", otp: "12ab56" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("returns a configuration error when Twilio env vars are missing", async () => {
    delete process.env.TWILIO_VERIFY_SERVICE_SID;

    const response = await POST(
      new Request("http://localhost/api/verify_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234", otp: "123456" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "SMS verification is not configured.",
    });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("returns success when Twilio approves the passcode", async () => {
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "approved" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/verify_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234", otp: "123456" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(h.fetchMock).toHaveBeenCalledWith(
      "https://verify.twilio.com/v2/Services/VA123/VerificationCheck",
      expect.objectContaining({
        method: "POST",
        body: "To=%2B14165551234&Code=123456",
      })
    );
  });

  it("returns invalid OTP when Twilio does not approve the code", async () => {
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/verify_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234", otp: "123456" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Invalid OTP",
    });
  });

  it("surfaces upstream Twilio verification failures", async () => {
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Verification check failed" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/verify_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234", otp: "123456" }),
      })
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Verification check failed",
    });
  });
});
