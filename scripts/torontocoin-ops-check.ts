import { getTorontoCoinOpsStatus } from "../shared/lib/contracts/torontocoinOps.ts";
import { getIndexerScopeStatusReadModel } from "../shared/lib/indexer/statusReadModel.ts";
import {
  createReleaseHealthSupabaseClient,
  describeSupabaseAccessError,
  loadRepoEnv,
} from "./load-repo-env.ts";

loadRepoEnv();

function collectReleaseBlockers(options: {
  opsStatus: Awaited<ReturnType<typeof getTorontoCoinOpsStatus>>;
  indexerStatus: Awaited<ReturnType<typeof getIndexerScopeStatusReadModel>>;
}) {
  const blockers: string[] = [];
  const tracking = options.indexerStatus.torontoCoinTracking;

  if (!tracking) {
    blockers.push("Indexer status returned no TorontoCoin tracking payload.");
    return blockers;
  }

  if (!tracking.cplTcoinTracked) {
    blockers.push("Indexer is not tracking the required cplTCOIN token.");
  }

  for (const pool of options.opsStatus.pools) {
    const trackedPool = tracking.trackedPools.find(
      (entry) => entry.poolId.toLowerCase() === pool.poolId.toLowerCase()
    );

    if (pool.expectedIndexerVisibility && !trackedPool?.tracked) {
      blockers.push(`${pool.name} is expected to be indexed but is not currently tracked.`);
    }

    if (pool.acceptanceEnabled && !(pool.scenarioPreview?.healthy ?? false)) {
      blockers.push(`${pool.name} is acceptance-enabled but its Scenario B preview is failing.`);
    }
  }

  return blockers;
}

async function main() {
  const opsStatus = await getTorontoCoinOpsStatus();
  const supabase = createReleaseHealthSupabaseClient();
  const indexerStatus = await getIndexerScopeStatusReadModel({
    supabase,
    citySlug: "tcoin",
    chainId: opsStatus.addresses.chainId,
    requiredTokenAddress: opsStatus.addresses.cplTcoin,
  });
  const blockers = collectReleaseBlockers({
    opsStatus,
    indexerStatus,
  });

  const summary = [
    "TorontoCoin ops check",
    `Chain: ${opsStatus.addresses.chainId}`,
    `Router: ${opsStatus.addresses.liquidityRouter}`,
    `Pool registry: ${opsStatus.addresses.poolRegistry}`,
    `Tracked pools: ${opsStatus.addresses.trackedPoolCount}`,
    `Reserve route healthy: ${String(
      opsStatus.reserveRouteHealth.reserveAssetActive &&
        opsStatus.reserveRouteHealth.mentoUsdcRouteConfigured &&
        opsStatus.reserveRouteHealth.liquidityRouterPointerHealthy &&
        opsStatus.reserveRouteHealth.treasuryControllerPointerHealthy
    )}`,
    `Indexer cplTCOIN tracked: ${String(
      indexerStatus.torontoCoinTracking?.cplTcoinTracked ?? false
    )}`,
    ...opsStatus.pools.map((pool) => {
      const trackedPool = indexerStatus?.torontoCoinTracking?.trackedPools.find(
        (entry) => entry.poolId.toLowerCase() === pool.poolId.toLowerCase()
      );
      const preview = pool.scenarioPreview?.cplTcoinOutFormatted ?? "n/a";
      const cplBalance =
        pool.tokensStatus.find((token) => token.symbol.toLowerCase() === "cpltcoin")?.balanceFormatted ?? "n/a";
      return `${pool.name}: indexed=${trackedPool?.tracked ? "yes" : "no"} cpl=${cplBalance} preview=${preview}`;
    }),
  ];

  const payload = {
    ...opsStatus,
    indexer: indexerStatus?.torontoCoinTracking ?? null,
    releaseBlockers: blockers,
  };

  console.log(summary.join("\n"));
  if (blockers.length > 0) {
    console.error(`\nRelease blockers:\n- ${blockers.join("\n- ")}`);
  }
  console.log(
    JSON.stringify(
      payload,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
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
