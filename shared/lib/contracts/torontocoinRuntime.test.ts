import { describe, expect, it } from "vitest";
import {
  TORONTOCOIN_RUNTIME,
  getConfiguredTorontoCoinTrackedPools,
  getTorontoCoinRuntimeConfig,
  getTorontoCoinWalletRuntimeSelection,
  parseTorontoCoinPreviewRuntimeManifest,
  getTorontoCoinWalletToken,
  isTorontoCoinRuntimeScope,
} from "./torontocoinRuntime";

describe("torontocoinRuntime", () => {
  const previewManifest = JSON.stringify({
    target: "celo-sepolia-pay-link",
    purpose: "pay-link-only",
    chainId: 11142220,
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    explorerBaseUrl: "https://celo-sepolia.blockscout.com/",
    poolRegistry: "0x0000000000000000000000000000000000000011",
    sarafuSwapPoolAdapter: "0x0000000000000000000000000000000000000012",
    bootstrapSwapPool: "0x0000000000000000000000000000000000000013",
    mrTcoin: {
      address: "0x0000000000000000000000000000000000000014",
      symbol: "mrTCOIN-cs",
      name: "Municipal Reserve TCOIN (Celo Sepolia)",
      decimals: 6,
    },
    cplTcoin: {
      address: "0x0000000000000000000000000000000000000015",
      symbol: "cplTCOIN-cs",
      name: "Cross Pool Liquidity TCOIN (Celo Sepolia)",
      decimals: 6,
    },
    transferGasLimit: "250000",
    maxFeePerGasWei: "100000000000",
  });

  it("resolves the checked-in Celo mainnet runtime", () => {
    expect(
      getTorontoCoinRuntimeConfig({
        citySlug: "tcoin",
        chainId: 42220,
      })
    ).toEqual(TORONTOCOIN_RUNTIME);
  });

  it("exposes cplTCOIN as the wallet-facing token", () => {
    expect(getTorontoCoinWalletToken({ citySlug: "tcoin", chainId: 42220 })).toEqual(
      TORONTOCOIN_RUNTIME.cplTcoin
    );
    expect(isTorontoCoinRuntimeScope({ citySlug: "tcoin", chainId: 42220 })).toBe(true);
    expect(isTorontoCoinRuntimeScope({ citySlug: "other", chainId: 42220 })).toBe(false);
  });

  it("exposes the configured tracked bootstrap pool", () => {
    const trackedPools = getConfiguredTorontoCoinTrackedPools({
      citySlug: "tcoin",
      chainId: 42220,
    });

    expect(trackedPools).toHaveLength(1);
    expect(trackedPools[0]?.poolId).toBe(TORONTOCOIN_RUNTIME.bootstrapPoolId);
    expect(trackedPools[0]?.poolAddress).toBe(TORONTOCOIN_RUNTIME.bootstrapSwapPool);
    expect(trackedPools[0]?.expectedIndexerVisibility).toBe(true);
  });

  it("parses the dedicated six-decimal Celo Sepolia pay-link runtime", () => {
    expect(parseTorontoCoinPreviewRuntimeManifest(previewManifest)).toMatchObject({
      target: "celo-sepolia-pay-link",
      purpose: "pay-link-only",
      chainId: 11142220,
      cplTcoin: { symbol: "cplTCOIN-cs", decimals: 6 },
      transferGasLimit: BigInt(250000),
    });
  });

  it("fails closed when Preview is missing or malformed and rejects it in Production", () => {
    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "celo-sepolia-pay-link",
        manifest: "",
        appEnvironment: "staging",
        citySlug: "tcoin",
      })
    ).toMatchObject({ configured: false, reason: expect.stringContaining("not configured") });

    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "celo-sepolia-pay-link",
        manifest: previewManifest.replace("11142220", "42220"),
        appEnvironment: "staging",
        citySlug: "tcoin",
      })
    ).toMatchObject({ configured: false, reason: expect.stringContaining("11142220") });

    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "celo-sepolia-pay-link",
        manifest: previewManifest,
        appEnvironment: "production",
        citySlug: "tcoin",
      })
    ).toMatchObject({ configured: false, reason: expect.stringContaining("disabled") });
  });

  it("does not silently select mainnet for an unconfigured non-Production environment", () => {
    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "",
        manifest: "",
        appEnvironment: "staging",
        citySlug: "tcoin",
      })
    ).toMatchObject({ configured: false, reason: expect.stringContaining("not configured") });
    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "celo-mainnet",
        appEnvironment: "production",
        citySlug: "tcoin",
      })
    ).toMatchObject({ configured: true, runtime: { chainId: 42220 } });
  });

  it("rejects non-Toronto city scopes rather than returning the TCOIN token", () => {
    expect(
      getTorontoCoinWalletRuntimeSelection({
        target: "celo-mainnet",
        appEnvironment: "production",
        citySlug: "other",
      })
    ).toMatchObject({ configured: false, reason: expect.stringContaining("other") });
  });
});
