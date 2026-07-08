import type { VoucherPreference, VoucherTrustStatus } from "./types";

function normalizeAddress(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase() || null;
}

type PreferenceMatchOptions = {
  preferences: VoucherPreference[];
  merchantStoreId?: number;
  tokenAddress?: `0x${string}`;
};

export function findMatchingPreferences(options: PreferenceMatchOptions): VoucherPreference[] {
  const token = normalizeAddress(options.tokenAddress);

  return options.preferences.filter((preference) => {
    const merchantMatches =
      preference.merchantStoreId == null ||
      options.merchantStoreId == null ||
      preference.merchantStoreId === options.merchantStoreId;

    const prefToken = normalizeAddress(preference.tokenAddress);
    const tokenMatches = prefToken == null || token == null || prefToken === token;

    return merchantMatches && tokenMatches;
  });
}

export function resolveTrustStatus(options: {
  preferences: VoucherPreference[];
  merchantStoreId?: number;
  tokenAddress?: `0x${string}`;
  defaultAccepted: boolean;
}): { accepted: boolean; status: VoucherTrustStatus; reason: string } {
  const matching = findMatchingPreferences({
    preferences: options.preferences,
    merchantStoreId: options.merchantStoreId,
    tokenAddress: options.tokenAddress,
  });

  if (matching.some((preference) => preference.trustStatus === "blocked")) {
    return {
      accepted: false,
      status: "blocked",
      reason: "Blocked by your voucher preferences.",
    };
  }

  if (matching.some((preference) => preference.trustStatus === "trusted")) {
    return {
      accepted: true,
      status: "trusted",
      reason: "Trusted by your voucher preferences.",
    };
  }

  return {
    accepted: options.defaultAccepted,
    status: "default",
    reason: options.defaultAccepted
      ? "Accepted by default compatibility rules."
      : "Not in your default voucher acceptance scope.",
  };
}
