import { beforeEach, describe, expect, it, vi } from "vitest";

// Error/success cases salvaged from e2e08a8 and adapted to the current Auth
// transport. Verification must keep its session instead of returning success only.
const mocks = vi.hoisted(() => ({ send: vi.fn(), verify: vi.fn(), snapshot: vi.fn() }));
vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp: mocks.send, verifyOtp: mocks.verify } }),
}));
vi.mock("@shared/lib/supabase/session", () => ({
  resolveSessionSnapshot: vi.fn(), setSessionSnapshot: mocks.snapshot,
}));

import { sendPasscode, verifyPasscode } from "./supabaseService";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ data: { session: null }, error: null });
});

describe("passcode recovery regression", () => {
  it.each(["email", "phone"] as const)("sends %s through the existing Auth transport", async (method) => {
    await sendPasscode({ contact: "test-contact", method });
    expect(mocks.send).toHaveBeenCalledWith({ [method]: "test-contact" });
  });

  it("preserves provider rate-limit failures without retrying", async () => {
    const failure = new Error("email rate limit exceeded");
    mocks.send.mockResolvedValue({ error: failure });
    await expect(sendPasscode({ contact: "person@example.com", method: "email" })).rejects.toBe(failure);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("preserves upstream errors without pretending a code was sent", async () => {
    const failure = new TypeError("fetch failed");
    mocks.send.mockRejectedValue(failure);
    await expect(sendPasscode({ contact: "person@example.com", method: "email" })).rejects.toBe(failure);
  });

  it.each(["email", "phone"] as const)("returns and snapshots a verified %s session", async (method) => {
    const session = { access_token: "test-session-token" };
    mocks.verify.mockResolvedValue({ data: { session }, error: null });
    await expect(verifyPasscode({ contact: "test-contact", method, passcode: "123456" })).resolves.toBe(session);
    expect(mocks.verify).toHaveBeenCalledWith({ [method]: "test-contact", token: "123456", type: method === "phone" ? "sms" : "email" });
    expect(mocks.snapshot).toHaveBeenCalledWith(session);
  });

  it("does not replace the snapshot after a rejected verification", async () => {
    const failure = new Error("invalid code");
    mocks.verify.mockResolvedValue({ data: { session: null }, error: failure });
    await expect(verifyPasscode({ contact: "person@example.com", method: "email", passcode: "123456" })).rejects.toBe(failure);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("does not invent a session when the provider returns none", async () => {
    await expect(verifyPasscode({ contact: "person@example.com", method: "email", passcode: "123456" })).resolves.toBeNull();
    expect(mocks.snapshot).toHaveBeenCalledWith(null);
  });
});
