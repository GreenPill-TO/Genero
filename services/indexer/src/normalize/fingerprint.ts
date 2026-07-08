import { keccak256, stringToBytes } from "viem";
import type { NormalizedEvent } from "../types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

export function buildEventFingerprint(event: NormalizedEvent): string {
  const payload = stableStringify(event.payload);

  return keccak256(
    stringToBytes(
      [
        event.source,
        String(event.chainId),
        String(event.blockNumber),
        event.txHash.toLowerCase(),
        String(event.logIndex),
        event.contractAddress.toLowerCase(),
        event.transactionType,
        payload,
      ].join("|")
    )
  );
}
