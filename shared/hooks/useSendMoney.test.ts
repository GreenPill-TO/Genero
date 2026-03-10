import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cubid-wallet", () => {
  class MockWebAuthnCrypto {
    async decryptString() {
      return "mocked";
    }
  }

  return {
    WebAuthnCrypto: MockWebAuthnCrypto,
  };
});

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

describe("resolveShareSelection", () => {
  it("selects the share that matches the active credential", () => {
    const result = __internal.resolveShareSelection({
      activeCredentialId: "beef",
      activeAppSlug: "wallet-tcoin",
      userShares: [
        { id: 1, credential_id: "aaaa", user_share_encrypted: { id: "share-1" } },
        { id: 2, credential_id: "BEEF", user_share_encrypted: { id: "share-2" } },
      ],
    });

    expect(result.selectedShare.id).toBe(2);
    expect(result.credentialCandidates).toEqual(["aaaa", "beef"]);
    expect(result.usedCredentialFallback).toBe(false);
  });

  it("falls back to the most recent share when the active credential is missing", () => {
    const result = __internal.resolveShareSelection({
      activeCredentialId: "missing-credential",
      activeAppSlug: "wallet-tcoin",
      userShares: [
        { id: 8, credential_id: "recent-credential", user_share_encrypted: { id: "share-recent" } },
        { id: 5, credential_id: "older-credential", user_share_encrypted: { id: "share-older" } },
      ],
    });

    expect(result.selectedShare.id).toBe(8);
    expect(result.usedCredentialFallback).toBe(true);
    expect(result.credentialCandidates).toEqual(["recent-credential", "older-credential"]);
  });

  it("throws an app-scoped error when no shares are available", () => {
    expect(() =>
      __internal.resolveShareSelection({
        activeCredentialId: null,
        activeAppSlug: "sparechange-tcoin",
        userShares: [],
      })
    ).toThrow(
      'No user shares were found for app instance "sparechange-tcoin". Reconnect your wallet to refresh passkey credentials.'
    );
  });

  it("normalises and filters credential candidates", () => {
    const result = __internal.resolveShareSelection({
      activeCredentialId: null,
      activeAppSlug: "wallet-tcoin",
      userShares: [
        { id: 11, credential_id: "  FACE  ", user_share_encrypted: { id: "share-11" } },
        { id: 12, credential_id: "", user_share_encrypted: { id: "share-12" } },
        { id: 13, credential_id: null, user_share_encrypted: { id: "share-13" } },
      ],
    });

    expect(result.credentialCandidates).toEqual(["face"]);
    expect(result.selectedShare.id).toBe(11);
  });
});
