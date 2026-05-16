import { getAddress, isAddress, type Address } from "viem";
import type { NormalizedEvent, TrackerEvent } from "../types";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeTrackerEvent(event: TrackerEvent, chainId: number): NormalizedEvent | null {
  if (!event.transactionHash || !isAddress(event.contractAddress)) {
    return null;
  }

  return {
    source: "tracker",
    chainId,
    blockNumber: toNumber(event.block),
    txHash: event.transactionHash,
    logIndex: toNumber(event.logIndex),
    contractAddress: getAddress(event.contractAddress),
    success: Boolean(event.success),
    timestamp: toNumber(event.timestamp),
    transactionType: String(event.transactionType ?? "UNKNOWN").toUpperCase(),
    payload: (event.payload ?? {}) as Record<string, unknown>,
  };
}

export async function pullTrackerEvents(options: {
  trackerPullUrl?: string;
  scopeKey: string;
  citySlug: string;
  chainId: number;
  fromBlock: number;
  toBlock: number;
  addresses: Address[];
}): Promise<{ available: boolean; events: NormalizedEvent[] }> {
  if (!options.trackerPullUrl) {
    return { available: false, events: [] };
  }

  const response = await fetch(options.trackerPullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scopeKey: options.scopeKey,
      citySlug: options.citySlug,
      chainId: options.chainId,
      fromBlock: options.fromBlock,
      toBlock: options.toBlock,
      addresses: options.addresses,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tracker pull failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  const rawEvents: TrackerEvent[] = Array.isArray(body)
    ? (body as TrackerEvent[])
    : Array.isArray(body?.events)
      ? (body.events as TrackerEvent[])
      : [];

  const events = rawEvents
    .map((event: TrackerEvent) => normalizeTrackerEvent(event, options.chainId))
    .filter((event): event is NormalizedEvent => Boolean(event));

  return {
    available: true,
    events,
  };
}
