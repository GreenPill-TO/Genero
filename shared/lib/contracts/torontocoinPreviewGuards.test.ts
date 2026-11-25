import { afterEach, describe, expect, it } from "vitest";
import { createTorontoCoinPublicClient, getTorontoCoinTrackedPoolStatuses } from "./torontocoinPools";
import { getTorontoCoinOpsStatus } from "./torontocoinOps";

describe("TorontoCoin Preview operational guards", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET;
    delete process.env.NEXT_PUBLIC_APP_ENVIRONMENT;
    delete process.env.NEXT_PUBLIC_CITYCOIN;
    delete process.env.VERCEL_ENV;
  });

  it.each([
    ["staging", undefined],
    ["development", "unknown-target"],
    ["development", "celo-mainnet"],
  ])("blocks mainnet client creation for app environment %s and target %s", (appEnvironment, target) => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = appEnvironment;
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    if (target) process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = target;
    expect(() => createTorontoCoinPublicClient()).toThrow("explicit Production celo-mainnet");
  });

  it("admits the legacy client only for explicit Production mainnet", () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "production";
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-mainnet";
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    expect(() => createTorontoCoinPublicClient()).not.toThrow();
  });

  it("blocks pool clients and reads before any mainnet RPC is created", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "development";
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-sepolia-pay-link";
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    process.env.VERCEL_ENV = "production";
    expect(() => createTorontoCoinPublicClient()).toThrow("explicit Production celo-mainnet");
    await expect(getTorontoCoinTrackedPoolStatuses()).rejects.toThrow("explicit Production celo-mainnet");
  });

  it("blocks the mainnet operational status surface", async () => {
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-sepolia-pay-link";
    await expect(getTorontoCoinOpsStatus()).rejects.toThrow("explicit Production celo-mainnet");
  });
});
