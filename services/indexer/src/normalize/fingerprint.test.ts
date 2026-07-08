import { describe, expect, it } from "vitest";
import { buildEventFingerprint } from "./fingerprint";

describe("buildEventFingerprint", () => {
  it("is stable regardless of payload key order", () => {
    const base = {
      source: "tracker",
      chainId: 42220,
      blockNumber: 1,
      txHash: "0xabc",
      logIndex: 0,
      contractAddress: "0x0000000000000000000000000000000000000001",
      success: true,
      timestamp: 1,
      transactionType: "TOKEN_TRANSFER",
    } as const;

    const a = buildEventFingerprint({
      ...base,
      payload: {
        a: "1",
        b: "2",
      },
    });

    const b = buildEventFingerprint({
      ...base,
      payload: {
        b: "2",
        a: "1",
      },
    });

    expect(a).toBe(b);
  });
});
