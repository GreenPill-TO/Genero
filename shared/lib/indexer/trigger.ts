import type { IndexerScopeStatus, IndexerTouchResponse } from "./types";

const LOCAL_COOLDOWN_MS = 5 * 60 * 1000;
const MEMORY_TOUCHES = new Map<string, number>();
const STORAGE_PREFIX = "indexer-touch:v1:";

function normalizeCitySlug(citySlug?: string): string {
  return (citySlug ?? process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
}

function storageKey(citySlug: string): string {
  return `${STORAGE_PREFIX}${citySlug}`;
}

function readLocalTouch(citySlug: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey(citySlug));
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function writeLocalTouch(citySlug: string, timestamp: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(citySlug), String(timestamp));
}

function hasLocalCooldown(citySlug: string): boolean {
  const now = Date.now();
  const inMemory = MEMORY_TOUCHES.get(citySlug) ?? 0;
  const inStorage = readLocalTouch(citySlug) ?? 0;
  const lastTouch = Math.max(inMemory, inStorage);

  return now - lastTouch < LOCAL_COOLDOWN_MS;
}

function markLocalTouch(citySlug: string) {
  const now = Date.now();
  MEMORY_TOUCHES.set(citySlug, now);
  writeLocalTouch(citySlug, now);
}

export async function triggerIndexerTouch(options?: {
  citySlug?: string;
  bypassLocalCooldown?: boolean;
}): Promise<IndexerTouchResponse> {
  const citySlug = normalizeCitySlug(options?.citySlug);

  if (!options?.bypassLocalCooldown && hasLocalCooldown(citySlug)) {
    return {
      scopeKey: citySlug,
      started: false,
      skipped: true,
      reason: "client_cooldown",
    };
  }

  const response = await fetch("/api/indexer/touch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ citySlug }),
  });

  const body = (await response.json()) as IndexerTouchResponse | { error?: string };

  if (!response.ok && !response.status.toString().startsWith("2")) {
    const message = "error" in body ? body.error : "Indexer touch request failed";
    throw new Error(message);
  }

  markLocalTouch(citySlug);

  return body as IndexerTouchResponse;
}

export async function fetchIndexerStatus(citySlug?: string): Promise<IndexerScopeStatus> {
  const slug = normalizeCitySlug(citySlug);
  const response = await fetch(`/api/indexer/status?citySlug=${encodeURIComponent(slug)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const body = (await response.json()) as IndexerScopeStatus | { error?: string };
  if (!response.ok) {
    const message = "error" in body ? body.error : "Failed to fetch indexer status";
    throw new Error(message);
  }

  return body as IndexerScopeStatus;
}
