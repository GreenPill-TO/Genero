import { loadRepoEnv } from "./load-repo-env.ts";
import { createServiceRoleClientCore } from "../shared/lib/supabase/serviceRoleCore.ts";
import { drainIndexerTouchQueueOnce } from "../services/indexer/src/touchQueue.ts";

loadRepoEnv();

async function main() {
  const supabase = createServiceRoleClientCore({
    context: "indexer touch worker",
  });
  const scopeKey = process.env.INDEXER_TOUCH_WORKER_SCOPE_KEY?.trim() || null;
  const result = await drainIndexerTouchQueueOnce({ supabase, scopeKey });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scopeKey,
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
  process.exitCode = 1;
});
