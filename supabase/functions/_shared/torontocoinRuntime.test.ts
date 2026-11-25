import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("npm:viem@2.23.3", () => ({
  default: { getAddress: (value: string) => value },
  getAddress: (value: string) => value,
}));

import { getTorontoCoinRuntimeConfig } from "./torontocoinRuntime";

describe("edge TorontoCoin runtime selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not expose the mainnet runtime to the isolated Preview target", () => {
    vi.stubGlobal("Deno", {
      env: { get: (name: string) => name === "NEXT_PUBLIC_TCOIN_RUNTIME_TARGET" ? "celo-sepolia-pay-link" : undefined },
    });
    expect(getTorontoCoinRuntimeConfig({ citySlug: "tcoin", chainId: 42220 })).toBeNull();
  });

  it("retains the explicitly selected production runtime", () => {
    vi.stubGlobal("Deno", {
      env: { get: (name: string) => ({ NEXT_PUBLIC_TCOIN_RUNTIME_TARGET: "celo-mainnet", NEXT_PUBLIC_APP_ENVIRONMENT: "production" } as Record<string, string>)[name] },
    });
    expect(getTorontoCoinRuntimeConfig({ citySlug: "tcoin", chainId: 42220 })?.chainId).toBe(42220);
  });

  it.each([
    ["staging", undefined],
    ["development", "unknown-target"],
    ["development", "celo-mainnet"],
  ])("fails closed for %s with target %s", (appEnvironment, target) => {
    vi.stubGlobal("Deno", {
      env: { get: (name: string) => ({ NEXT_PUBLIC_TCOIN_RUNTIME_TARGET: target, NEXT_PUBLIC_APP_ENVIRONMENT: appEnvironment } as Record<string, string | undefined>)[name] },
    });
    expect(getTorontoCoinRuntimeConfig({ citySlug: "tcoin", chainId: 42220 })).toBeNull();
  });
});
