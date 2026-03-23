import { describe, expect, it } from "vitest";
import {
  TORONTOCOIN_RUNTIME,
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
});
