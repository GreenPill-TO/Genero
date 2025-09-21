import { afterEach, describe, expect, it } from "vitest";
import { __internal, WebAuthnRequestInProgressError } from "./useSendMoney";

describe("runWithWebAuthnLock", () => {
  afterEach(() => {
    __internal.resetWebAuthnLock();
  });

  it("prevents concurrent WebAuthn requests", async () => {
    const slowPromise = __internal.runWithWebAuthnLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    });

    await expect(
      __internal.runWithWebAuthnLock(async () => "second")
    ).rejects.toBeInstanceOf(WebAuthnRequestInProgressError);

    await slowPromise;
  });

  it("releases the lock after completion", async () => {
    await __internal.runWithWebAuthnLock(async () => "first");

    await expect(
      __internal.runWithWebAuthnLock(async () => "second")
    ).resolves.toBe("second");
  });
});
