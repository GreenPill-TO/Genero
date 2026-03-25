import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getIndexerScopeStatus } from "../services/indexer/src/index.ts";
import { getTorontoCoinOpsStatus } from "../shared/lib/contracts/torontocoinOps.ts";

function createIndexerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function main() {
  const status = await getTorontoCoinOpsStatus();
  const supabase = createIndexerClient();
  const indexerStatus = supabase
    ? await getIndexerScopeStatus({
        supabase,
        citySlug: "tcoin",
      })
    : null;

  const poolSummaries = status.pools.map((pool) => {
    const indexerPool = indexerStatus?.torontoCoinTracking?.trackedPools.find(
      (entry) => entry.poolId.toLowerCase() === pool.poolId.toLowerCase()
    );

    return {
      poolId: pool.poolId,
      poolAddress: pool.poolAddress,
      name: pool.name,
      registered: pool.registration.registryAddressMatches,
      active: pool.registration.active,
      feeBypassEligible: pool.registration.feeBypassEligible,
      limiterHealthy: pool.limiter.healthy,
      quoteHealthy: pool.quoteChecks.every((quote) => quote.healthy),
      previewHealthy: pool.scenarioPreview?.healthy ?? false,
      indexed: indexerPool?.tracked ?? false,
      indexedHealthy: indexerPool?.healthy ?? false,
    };
  });

  const summary = [
    "TorontoCoin pool compatibility",
    ...poolSummaries.map(
      (pool) =>
        `${pool.name}: registered=${pool.registered ? "yes" : "no"} active=${pool.active ? "yes" : "no"} indexed=${pool.indexed ? "yes" : "no"} preview=${pool.previewHealthy ? "ok" : "fail"}`
    ),
  ];

  console.log(summary.join("\n"));
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reserveRouteHealth: status.reserveRouteHealth,
        pools: poolSummaries,
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
