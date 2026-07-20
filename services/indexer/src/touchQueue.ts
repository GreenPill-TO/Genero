import type { SupabaseClient } from "@supabase/supabase-js";
import { runIndexerTouch } from "./index";
import { completeRun } from "./state/runControl";
import type { IndexerTouchResult } from "./types";

export type ClaimedIndexerTouchRequest = {
  requestId: number;
  scopeKey: string;
  citySlug: string;
  chainId: number;
  source: string;
  requestedAt: string;
  claimedAt: string | null;
  attemptCount: number;
};

export type DrainIndexerTouchQueueResult =
  | {
      processed: false;
      request: null;
      result: null;
    }
  | {
      processed: true;
      request: ClaimedIndexerTouchRequest;
      result: IndexerTouchResult;
    };

class IndexerTouchWorkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Indexer touch worker timed out after ${timeoutMs}ms.`);
    this.name = "IndexerTouchWorkerTimeoutError";
  }
}

function isPositiveTimeout(timeoutMs?: number | null): timeoutMs is number {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0;
}

async function withWorkerTimeout<T>(promise: Promise<T>, timeoutMs?: number | null): Promise<T> {
  if (!isPositiveTimeout(timeoutMs)) {
    return promise;
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new IndexerTouchWorkerTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseClaimedRequest(data: unknown): ClaimedIndexerTouchRequest | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;
  const requestId = Number(value.requestId);
  const chainId = Number(value.chainId);
  const attemptCount = Number(value.attemptCount ?? 0);

  if (!Number.isFinite(requestId) || !Number.isFinite(chainId)) {
    return null;
  }

  return {
    requestId,
    scopeKey: String(value.scopeKey ?? ""),
    citySlug: String(value.citySlug ?? ""),
    chainId,
    source: String(value.source ?? "worker"),
    requestedAt: String(value.requestedAt ?? ""),
    claimedAt: typeof value.claimedAt === "string" ? value.claimedAt : null,
    attemptCount,
  };
}

export async function claimIndexerTouchRequest(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey?: string | null;
}): Promise<ClaimedIndexerTouchRequest | null> {
  const supabase = options?.supabase;
  if (!supabase) {
    throw new Error("A scoped service-role Supabase client is required to claim indexer touch requests.");
  }

  const { data, error } = await supabase.schema("indexer").rpc("claim_touch_request_v1", {
    p_scope_key: options?.scopeKey ?? null,
  });

  if (error) {
    throw new Error(`Failed to claim indexer touch request: ${error.message}`);
  }

  return parseClaimedRequest(data);
}

export async function completeIndexerTouchRequest(options: {
  supabase: SupabaseClient<any, any, any>;
  requestId: number;
  status: "completed" | "failed";
  runStatus?: "success" | "error" | "skipped";
  error?: string;
}) {
  const supabase = options?.supabase;
  if (!supabase) {
    throw new Error("A scoped service-role Supabase client is required to complete indexer touch requests.");
  }

  const { error } = await supabase.schema("indexer").rpc("complete_touch_request_v1", {
    p_request_id: options.requestId,
    p_status: options.status,
    p_run_status: options.runStatus ?? null,
    p_error: options.error ?? null,
  });

  if (error) {
    throw new Error(`Failed to complete indexer touch request: ${error.message}`);
  }
}

export async function drainIndexerTouchQueueOnce(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey?: string | null;
  timeoutMs?: number | null;
}): Promise<DrainIndexerTouchQueueResult> {
  const supabase = options?.supabase;
  if (!supabase) {
    throw new Error("A scoped service-role Supabase client is required to drain indexer touch requests.");
  }

  const request = await claimIndexerTouchRequest({
    supabase,
    scopeKey: options.scopeKey,
  });

  if (!request) {
    return {
      processed: false,
      request: null,
      result: null,
    };
  }

  try {
    const result = await withWorkerTimeout(
      runIndexerTouch({
        supabase,
        citySlug: request.citySlug,
      }),
      options.timeoutMs
    );

    await completeIndexerTouchRequest({
      supabase,
      requestId: request.requestId,
      status: result.runStatus === "error" ? "failed" : "completed",
      runStatus:
        result.runStatus === "error"
          ? "error"
          : result.runStatus === "skipped"
            ? "skipped"
            : "success",
      error: result.error,
    });

    return {
      processed: true,
      request,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown indexer queue error";
    if (error instanceof IndexerTouchWorkerTimeoutError) {
      await completeRun({
        supabase,
        scopeKey: request.scopeKey,
        status: "error",
        errorMessage: message,
      });
    }
    await completeIndexerTouchRequest({
      supabase,
      requestId: request.requestId,
      status: "failed",
      runStatus: "error",
      error: message,
    });
    throw error;
  }
}
