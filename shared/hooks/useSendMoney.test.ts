import { afterEach, describe, expect, it, vi } from "vitest";

const { getActiveCityContractsMock, getRpcUrlForChainIdMock } = vi.hoisted(() => ({
  getActiveCityContractsMock: vi.fn(),
  getRpcUrlForChainIdMock: vi.fn(),
}));

const { getTorontoCoinRuntimeConfigMock } = vi.hoisted(() => ({
  getTorontoCoinRuntimeConfigMock: vi.fn(),
}));

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: getActiveCityContractsMock,
  getRpcUrlForChainId: getRpcUrlForChainIdMock,
}));

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  TORONTOCOIN_RUNTIME: {
    chainId: 42220,
    cplTcoin: {
      address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
      decimals: 6,
    },
    rpcUrl: "https://forno.celo.org",
  },
  getTorontoCoinRuntimeConfig: getTorontoCoinRuntimeConfigMock,
}));

vi.mock("cubid-wallet", () => ({
  WebAuthnCrypto: class MockWebAuthnCrypto {
    decryptString = vi.fn(async () => "stubbed-share");
  },
}));

import {
  resolveShareSelection,
  resolveTokenRuntimeConfig,
  WebAuthnRequestInProgressError,
} from "@shared/lib/wallet/sendMoneyShared";
import {
  resetWebAuthnRuntimeForTests,
  runWithWebAuthnLock,
} from "@shared/lib/wallet/sendMoneyRuntime";

describe("runWithWebAuthnLock", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    consoleWarnSpy.mockClear();
    resetWebAuthnRuntimeForTests();
    getActiveCityContractsMock.mockReset();
    getRpcUrlForChainIdMock.mockReset();
    getTorontoCoinRuntimeConfigMock.mockReset();
  });

  it("prevents concurrent WebAuthn requests", async () => {
    const slowPromise = runWithWebAuthnLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    });

    await expect(runWithWebAuthnLock(async () => "second")).rejects.toBeInstanceOf(
      WebAuthnRequestInProgressError
    );

    await slowPromise;
  });

  it("releases the lock after completion", async () => {
    await runWithWebAuthnLock(async () => "first");

    await expect(runWithWebAuthnLock(async () => "second")).resolves.toBe("second");
  });

  it("resolves token runtime config from the TorontoCoin runtime bridge on Celo mainnet", async () => {
    getTorontoCoinRuntimeConfigMock.mockReturnValue({
      cplTcoin: {
        address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
        decimals: 6,
      },
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
    });

    await expect(resolveTokenRuntimeConfig()).resolves.toEqual({
      tokenAddress: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      decimals: 6,
    });
  });

  it("falls back to runtime-aware defaults when registry resolution fails", async () => {
    getTorontoCoinRuntimeConfigMock.mockReturnValue(null);
    getActiveCityContractsMock.mockRejectedValue(new Error("registry unavailable"));
    getRpcUrlForChainIdMock.mockImplementation((chainId: number) => {
      if (chainId === 42220) return "https://forno.celo.org";
      throw new Error("unexpected chain");
    });

    await expect(resolveTokenRuntimeConfig()).resolves.toEqual({
      tokenAddress: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      decimals: 6,
    });
  });
});

describe("resolveShareSelection", () => {
  it("selects the share that matches the active credential", () => {
    const result = resolveShareSelection({
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
    const result = resolveShareSelection({
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
      resolveShareSelection({
        activeCredentialId: null,
        activeAppSlug: "sparechange-tcoin",
        userShares: [],
      })
    ).toThrow(
      'No user shares were found for app instance "sparechange-tcoin". Reconnect your wallet to refresh passkey credentials.'
    );
  });

  it("normalises and filters credential candidates", () => {
    const result = resolveShareSelection({
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
