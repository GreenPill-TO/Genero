import { getIndexerScopeStatus } from "../services/indexer/src/index.ts";
import { getTorontoCoinOpsStatus } from "../shared/lib/contracts/torontocoinOps.ts";
import {
  createOpsSupabaseClient,
  describeSupabaseAccessError,
  loadRepoEnv,
} from "./load-repo-env.ts";

loadRepoEnv();

async function main() {
  const status = await getTorontoCoinOpsStatus();
  const supabase = createOpsSupabaseClient();
  const indexerStatus = await getIndexerScopeStatus({
    supabase,
    citySlug: "tcoin",
  });

  const poolSummaries = status.pools.map((pool) => {
    const indexerPool = indexerStatus?.torontoCoinTracking?.trackedPools.find(
      (entry) => entry.poolId.toLowerCase() === pool.poolId.toLowerCase()
    );

    return {
      poolId: pool.poolId,
      poolAddress: pool.poolAddress,
      name: pool.name,
      expectedIndexerVisibility: pool.expectedIndexerVisibility,
      acceptanceEnabled: pool.acceptanceEnabled,
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

  const blockers = poolSummaries.flatMap((pool) => {
    const errors: string[] = [];
    if (pool.expectedIndexerVisibility && !pool.indexed) {
      errors.push(`${pool.name} is expected to be indexed but is currently missing from the tracked-pool set.`);
    }
    if (pool.acceptanceEnabled && !pool.previewHealthy) {
      errors.push(`${pool.name} is acceptance-enabled but previewBuyCplTcoin is failing.`);
    }
    if (!pool.registered || !pool.active) {
      errors.push(`${pool.name} is not fully registered and active.`);
    }
    return errors;
  });

  const summary = [
    "TorontoCoin pool compatibility",
    ...poolSummaries.map(
      (pool) =>
        `${pool.name}: registered=${pool.registered ? "yes" : "no"} active=${pool.active ? "yes" : "no"} indexed=${pool.indexed ? "yes" : "no"} preview=${pool.previewHealthy ? "ok" : "fail"}`
    ),
  ];

  console.log(summary.join("\n"));
  if (blockers.length > 0) {
    console.error(`\nRelease blockers:\n- ${blockers.join("\n- ")}`);
  }
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        reserveRouteHealth: status.reserveRouteHealth,
        pools: poolSummaries,
        releaseBlockers: blockers,
      },
      null,
      2
    )
  );

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(describeSupabaseAccessError(error));
  process.exitCode = 1;
});
