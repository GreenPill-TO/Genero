import { afterEach, describe, expect, it, vi } from "vitest";

const { getTorontoCoinWalletRuntimeOrThrowMock } = vi.hoisted(() => ({
  getTorontoCoinWalletRuntimeOrThrowMock: vi.fn(),
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
  getTorontoCoinWalletRuntimeOrThrow: getTorontoCoinWalletRuntimeOrThrowMock,
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
  runAfterRuntimeChainCheck,
  runWithWebAuthnLock,
} from "@shared/lib/wallet/sendMoneyRuntime";

describe("runWithWebAuthnLock", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    consoleWarnSpy.mockClear();
    resetWebAuthnRuntimeForTests();
    getTorontoCoinWalletRuntimeOrThrowMock.mockReset();
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

  it("rejects a wrong actual RPC chain before invoking signing material", async () => {
    const signingMaterial = vi.fn(async () => "private-material");
    await expect(
      runAfterRuntimeChainCheck(
        { getNetwork: async () => ({ chainId: 42220 }) },
        11142220,
        signingMaterial
      )
    ).rejects.toThrow("expected 11142220, received 42220");
    expect(signingMaterial).not.toHaveBeenCalled();
  });

  it("resolves token runtime config from the TorontoCoin runtime bridge on Celo mainnet", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockReturnValue({
      target: "celo-mainnet",
      purpose: "production",
      cplTcoin: {
        address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
        decimals: 6,
      },
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      explorerBaseUrl: "https://celoscan.io",
      transferGasLimit: BigInt(250000),
      maxFeePerGasWei: BigInt(100000000000),
    });

    await expect(resolveTokenRuntimeConfig()).resolves.toEqual({
      tokenAddress: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
      decimals: 6,
      explorerBaseUrl: "https://celoscan.io",
      maxFeePerGasWei: BigInt(100000000000),
      purpose: "production",
      target: "celo-mainnet",
      transferGasLimit: BigInt(250000),
    });
  });

  it("fails closed without consulting a registry or mainnet fallback", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockImplementation(() => {
      throw new Error("Preview wallet runtime is not configured.");
    });
    await expect(resolveTokenRuntimeConfig()).rejects.toThrow("not configured");
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
