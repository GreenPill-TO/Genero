import { describe, expect, it } from "vitest";
import { resolveTrustStatus } from "./preferences";
import type { VoucherPreference } from "./types";

const basePreference = {
  userId: 1,
  appInstanceId: 10,
  citySlug: "tcoin",
} as const;

describe("resolveTrustStatus", () => {
  it("prioritizes blocked over trusted and defaults", () => {
    const preferences: VoucherPreference[] = [
      {
        ...basePreference,
        trustStatus: "trusted",
      },
      {
        ...basePreference,
        trustStatus: "blocked",
      },
    ];

    const result = resolveTrustStatus({
      preferences,
      merchantStoreId: 5,
      tokenAddress: "0x0000000000000000000000000000000000000001",
      defaultAccepted: true,
    });

    expect(result.accepted).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("accepts trusted preference when default is denied", () => {
    const preferences: VoucherPreference[] = [
      {
        ...basePreference,
        merchantStoreId: 7,
        tokenAddress: "0x0000000000000000000000000000000000000002",
        trustStatus: "trusted",
      },
    ];

    const result = resolveTrustStatus({
      preferences,
      merchantStoreId: 7,
      tokenAddress: "0x0000000000000000000000000000000000000002",
      defaultAccepted: false,
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe("trusted");
  });

  it("falls back to default acceptance when no explicit preference is found", () => {
    const result = resolveTrustStatus({
      preferences: [],
      merchantStoreId: 3,
      tokenAddress: "0x0000000000000000000000000000000000000003",
      defaultAccepted: true,
    });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe("default");
  });
});
