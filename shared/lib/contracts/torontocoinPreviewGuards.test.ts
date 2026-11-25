import { afterEach, describe, expect, it } from "vitest";
import { createTorontoCoinPublicClient, getTorontoCoinTrackedPoolStatuses } from "./torontocoinPools";
import { getTorontoCoinOpsStatus } from "./torontocoinOps";

describe("TorontoCoin Preview operational guards", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET;
  });

  it("blocks pool clients and reads before any mainnet RPC is created", async () => {
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-sepolia-pay-link";
    expect(() => createTorontoCoinPublicClient()).toThrow("unavailable");
    await expect(getTorontoCoinTrackedPoolStatuses()).rejects.toThrow("unavailable");
  });

  it("blocks the mainnet operational status surface", async () => {
    process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET = "celo-sepolia-pay-link";
    await expect(getTorontoCoinOpsStatus()).rejects.toThrow("unavailable");
  });
});
