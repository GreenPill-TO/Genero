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
  const opsStatus = await getTorontoCoinOpsStatus();
  const supabase = createIndexerClient();
  const indexerStatus = supabase
    ? await getIndexerScopeStatus({
        supabase,
        citySlug: "tcoin",
      })
    : null;

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
  };

  console.log(summary.join("\n"));
  console.log(
    JSON.stringify(
      payload,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
