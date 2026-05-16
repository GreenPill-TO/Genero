/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/send_otp", () => {
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

  it("rejects missing or non-E.164 phone numbers", async () => {
    const response = await POST(
      new Request("http://localhost/api/send_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "4165551234" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("returns a configuration error when Twilio env vars are missing", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;

    const response = await POST(
      new Request("http://localhost/api/send_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "SMS verification is not configured.",
    });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("forwards Twilio verification requests", async () => {
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/send_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: "pending",
    });
    expect(h.fetchMock).toHaveBeenCalledWith(
      "https://verify.twilio.com/v2/Services/VA123/Verifications",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: "To=%2B14165551234&Channel=sms",
      })
    );
  });

  it("surfaces upstream Twilio failures", async () => {
    h.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Max check attempts reached" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      new Request("http://localhost/api/send_otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+14165551234" }),
      })
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Max check attempts reached",
    });
  });
});
