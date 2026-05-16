import { describe, expect, it } from "vitest";
import {
  TORONTOCOIN_RUNTIME,
  getConfiguredTorontoCoinTrackedPools,
  getTorontoCoinRuntimeConfig,
  getTorontoCoinWalletToken,
  isTorontoCoinRuntimeScope,
} from "./torontocoinRuntime";

describe("torontocoinRuntime", () => {
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
});
