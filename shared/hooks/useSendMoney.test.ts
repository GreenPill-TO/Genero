import { afterEach, describe, expect, it, vi } from "vitest";

const { getActiveCityContractsMock, getRpcUrlForChainIdMock } = vi.hoisted(() => ({
  getActiveCityContractsMock: vi.fn(),
  getRpcUrlForChainIdMock: vi.fn(),
}));

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: getActiveCityContractsMock,
  getRpcUrlForChainId: getRpcUrlForChainIdMock,
}));

vi.mock("cubid-wallet", () => ({
  WebAuthnCrypto: class MockWebAuthnCrypto {
    decryptString = vi.fn(async () => "stubbed-share");
  },
}));

import { __internal, WebAuthnRequestInProgressError } from "./useSendMoney";

describe("runWithWebAuthnLock", () => {
  afterEach(() => {
    __internal.resetWebAuthnLock();
    getActiveCityContractsMock.mockReset();
    getRpcUrlForChainIdMock.mockReset();
  });

  it("prevents concurrent WebAuthn requests", async () => {
    const slowPromise = __internal.runWithWebAuthnLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    });

    await expect(__internal.runWithWebAuthnLock(async () => "second")).rejects.toBeInstanceOf(
      WebAuthnRequestInProgressError
    );

    await slowPromise;
  });

  it("releases the lock after completion", async () => {
    await __internal.runWithWebAuthnLock(async () => "first");

    await expect(__internal.runWithWebAuthnLock(async () => "second")).resolves.toBe("second");
  });

  it("resolves token runtime config from city contracts registry data", async () => {
    getActiveCityContractsMock.mockResolvedValue({
      chainId: 545,
      contracts: { TCOIN: "0x0000000000000000000000000000000000000001" },
    });
    getRpcUrlForChainIdMock.mockReturnValue("https://testnet.evm.nodes.onflow.org");

    await expect(__internal.resolveTokenRuntimeConfig()).resolves.toEqual({
      tokenAddress: "0x0000000000000000000000000000000000000001",
      rpcUrl: "https://testnet.evm.nodes.onflow.org",
      chainId: 545,
    });
  });

  it("falls back to tcoin defaults when registry resolution fails", async () => {
    getActiveCityContractsMock.mockRejectedValue(new Error("registry unavailable"));
    getRpcUrlForChainIdMock.mockImplementation((chainId: number) => {
      if (chainId === 42220) return "https://forno.celo.org";
      throw new Error("unexpected chain");
    });

    await expect(__internal.resolveTokenRuntimeConfig()).resolves.toEqual({
      tokenAddress: "0x298a698031e2fd7d8f0c830f3fd887601b40058c",
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
    });
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
