import { loadRepoEnv } from "./load-repo-env.ts";
import { createServiceRoleClientCore } from "../shared/lib/supabase/serviceRoleCore.ts";
import { drainIndexerTouchQueueOnce } from "../services/indexer/src/touchQueue.ts";

loadRepoEnv();

const DEFAULT_WORKER_TIMEOUT_MS = 240_000;

function resolveWorkerTimeoutMs() {
  const configured = process.env.INDEXER_TOUCH_WORKER_TIMEOUT_MS?.trim();
  if (!configured) {
    return DEFAULT_WORKER_TIMEOUT_MS;
  }

  const parsed = Number(configured);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("INDEXER_TOUCH_WORKER_TIMEOUT_MS must be a positive number of milliseconds.");
  }

  return parsed;
}

async function main() {
  const supabase = createServiceRoleClientCore({
    context: "indexer touch worker",
  });
  const scopeKey = process.env.INDEXER_TOUCH_WORKER_SCOPE_KEY?.trim() || null;
  const timeoutMs = resolveWorkerTimeoutMs();
  const result = await drainIndexerTouchQueueOnce({ supabase, scopeKey, timeoutMs });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scopeKey,
        timeoutMs,
        processed: result.processed,
        request: result.request,
        result: result.result,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
