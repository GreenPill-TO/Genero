import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { deriveBiaRollupsAndRisk, syncBiaMappingValidation } from "./bia";
import { discoverTrackedPools } from "./discovery/pools";
import { resolveCityContractSet } from "./discovery/cityContracts";
import { pullRpcEvents } from "./ingest/rpcFallback";
import { pullTrackerEvents } from "./ingest/trackerClient";
import { persistNormalizedEvents } from "./normalize/persist";
import { deriveVoucherState } from "./vouchers";
import { ingestCityExchangeRate } from "./rates";
import {
  REQUIRED_POOL_ADDRESSES,
  REQUIRED_TCOIN_TOKEN,
  resolveIndexerConfig,
} from "./config";
import {
  buildScopeKey,
  completeRun,
  getCheckpoint,
  getScopeStatus,
  normaliseCitySlug,
  tryStartRun,
  upsertCheckpoint,
} from "./state/runControl";
import type { IndexerScopeStatus, IndexerTouchResult, IndexerSource, NormalizedEvent } from "./types";

function pickBlockRange(options: {
  latestBlock: number;
  initialBlock: number;
  maxBlocksPerRun: number;
  trackerCheckpoint: number;
  rpcCheckpoint: number;
}): { fromBlock: number; toBlock: number } | null {
  const lastIndexedBlock = Math.max(options.trackerCheckpoint, options.rpcCheckpoint);
  const fromBlock = Math.max(options.initialBlock, lastIndexedBlock + 1);

  if (fromBlock > options.latestBlock) {
    return null;
  }

  const toBlock = Math.min(options.latestBlock, fromBlock + Math.max(1, options.maxBlocksPerRun) - 1);
  return { fromBlock, toBlock };
}

function dedupeAddresses(addresses: Address[]): Address[] {
  const seen = new Set<string>();
  const deduped: Address[] = [];

  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (!seen.has(normalized)) {
      deduped.push(getAddress(address));
      seen.add(normalized);
    }
  }

  return deduped;
}

function filterEventsByAddress(events: NormalizedEvent[], addresses: Address[]): NormalizedEvent[] {
  const allowed = new Set(addresses.map((address) => address.toLowerCase()));
  return events.filter((event) => allowed.has(event.contractAddress.toLowerCase()));
}

export async function runIndexerTouch(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug?: string;
}): Promise<IndexerTouchResult> {
  const config = resolveIndexerConfig();
  const citySlug = normaliseCitySlug(options.citySlug ?? config.citySlug);
  const chainId = config.chainId;
  const scopeKey = buildScopeKey(citySlug, chainId);

  const startResult = await tryStartRun({
    supabase: options.supabase,
    scopeKey,
    citySlug,
    chainId,
    cooldownSeconds: config.cooldownSeconds,
  });

  if (!startResult.started) {
    return {
      scopeKey,
      started: false,
      skipped: true,
      reason: startResult.reason,
      nextEligibleAt: startResult.nextEligibleAt,
      runStatus: "skipped",
    };
  }

  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  try {
    const cityContracts = await resolveCityContractSet({
      supabase: options.supabase,
      citySlug,
      chainId,
    });

    await ingestCityExchangeRate({
      supabase: options.supabase,
      client,
      citySlug,
      cityContracts,
    });

    const discovery = await discoverTrackedPools({
      supabase: options.supabase,
      client,
      cityContracts,
      poolLimit: config.discoveryPoolLimit,
    });

    const biaMappingHealth = await syncBiaMappingValidation({
      supabase: options.supabase,
      citySlug,
      chainId,
      activePools: discovery.activePools,
    });

    const contractAddresses = Object.values(cityContracts.contracts).filter(
      (address): address is Address => Boolean(address)
    );

    const trackedAddresses = dedupeAddresses([...contractAddresses, ...discovery.trackedAddresses]);

    const [trackerCheckpoint, rpcCheckpoint, latestBlockBigInt] = await Promise.all([
      getCheckpoint({
        supabase: options.supabase,
        scopeKey,
        source: "tracker",
      }),
      getCheckpoint({
        supabase: options.supabase,
        scopeKey,
        source: "rpc",
      }),
      client.getBlockNumber(),
    ]);

    const latestBlock = Number(latestBlockBigInt);
    const blockRange = pickBlockRange({
      latestBlock,
      initialBlock: config.initialBlock,
      maxBlocksPerRun: config.maxBlocksPerRun,
      trackerCheckpoint: trackerCheckpoint?.lastBlock ?? 0,
      rpcCheckpoint: rpcCheckpoint?.lastBlock ?? 0,
    });

    if (!blockRange) {
      const biaDerived = await deriveBiaRollupsAndRisk({
        supabase: options.supabase,
        scopeKey,
        citySlug,
        chainId,
        fromBlock: latestBlock,
        toBlock: latestBlock,
        activePools: discovery.activePools,
      });
      const voucherDerived = await deriveVoucherState({
        supabase: options.supabase,
        client,
        scopeKey,
        chainId,
        cityContracts,
        activePools: discovery.activePools,
      });

      await completeRun({
        supabase: options.supabase,
        scopeKey,
        status: "success",
        cooldownSeconds: config.cooldownSeconds,
      });

      return {
        scopeKey,
        started: true,
        skipped: false,
        runStatus: "success",
        discovery: {
          scannedPools: discovery.scannedPools,
          activePools: discovery.activePools.length,
          trackedAddresses: trackedAddresses.length,
        },
        ingestion: {
          source: "rpc",
          fromBlock: latestBlock,
          toBlock: latestBlock,
          eventsSeen: 0,
          eventsPersisted: 0,
        },
        bia: {
          mappedPools: biaMappingHealth.mappedPools,
          unmappedPools: biaMappingHealth.unmappedPools,
          staleMappings: biaMappingHealth.staleMappings,
          componentMismatches: biaMappingHealth.componentMismatches,
          rollupRows: biaDerived.rollupRows,
          riskSignals: biaDerived.riskSignals,
        },
        voucher: voucherDerived,
      };
    }

    let sourceUsed: IndexerSource = "rpc";
    let events: NormalizedEvent[] = [];

    if (config.trackerPullUrl) {
      try {
        const trackerResult = await pullTrackerEvents({
          trackerPullUrl: config.trackerPullUrl,
          scopeKey,
          citySlug,
          chainId,
          fromBlock: blockRange.fromBlock,
          toBlock: blockRange.toBlock,
          addresses: trackedAddresses,
        });

        if (trackerResult.available) {
          sourceUsed = "tracker";
          events = filterEventsByAddress(trackerResult.events, trackedAddresses);
        }
      } catch {
        sourceUsed = "rpc";
      }
    }

    if (sourceUsed === "rpc") {
      events = await pullRpcEvents({
        client,
        chainId,
        fromBlock: blockRange.fromBlock,
        toBlock: blockRange.toBlock,
        trackedAddresses,
      });
    }

    const persistResult = await persistNormalizedEvents({
      supabase: options.supabase,
      scopeKey,
      events,
    });

    const biaDerived = await deriveBiaRollupsAndRisk({
      supabase: options.supabase,
      scopeKey,
      citySlug,
      chainId,
      fromBlock: blockRange.fromBlock,
      toBlock: blockRange.toBlock,
      activePools: discovery.activePools,
    });
    const voucherDerived = await deriveVoucherState({
      supabase: options.supabase,
      client,
      scopeKey,
      chainId,
      cityContracts,
      activePools: discovery.activePools,
    });

    await upsertCheckpoint({
      supabase: options.supabase,
      scopeKey,
      source: sourceUsed,
      lastBlock: blockRange.toBlock,
      lastTxHash: persistResult.lastTxHash,
    });

    await completeRun({
      supabase: options.supabase,
      scopeKey,
      status: "success",
      cooldownSeconds: config.cooldownSeconds,
    });

    return {
      scopeKey,
      started: true,
      skipped: false,
      runStatus: "success",
      discovery: {
        scannedPools: discovery.scannedPools,
        activePools: discovery.activePools.length,
        trackedAddresses: trackedAddresses.length,
      },
      ingestion: {
        source: sourceUsed,
        fromBlock: blockRange.fromBlock,
        toBlock: blockRange.toBlock,
        eventsSeen: events.length,
        eventsPersisted: persistResult.persistedEvents,
      },
      bia: {
        mappedPools: biaMappingHealth.mappedPools,
        unmappedPools: biaMappingHealth.unmappedPools,
        staleMappings: biaMappingHealth.staleMappings,
        componentMismatches: biaMappingHealth.componentMismatches,
        rollupRows: biaDerived.rollupRows,
        riskSignals: biaDerived.riskSignals,
      },
      voucher: voucherDerived,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown indexer error";

    await completeRun({
      supabase: options.supabase,
      scopeKey,
      status: "error",
      errorMessage: message,
      cooldownSeconds: config.cooldownSeconds,
    });

    return {
      scopeKey,
      started: true,
      skipped: false,
      runStatus: "error",
      error: message,
    };
  }
}

export async function getIndexerScopeStatus(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug?: string;
}): Promise<IndexerScopeStatus> {
  const config = resolveIndexerConfig();
  const citySlug = normaliseCitySlug(options.citySlug ?? config.citySlug);
  const scopeKey = buildScopeKey(citySlug, config.chainId);
  const status = await getScopeStatus({
    supabase: options.supabase,
    scopeKey,
    citySlug,
    chainId: config.chainId,
  });

  return {
    ...status,
    torontoCoinTracking:
      citySlug === "tcoin" && config.chainId === 42220
        ? {
            requiredPoolAddress: REQUIRED_POOL_ADDRESSES[0],
            requiredTokenAddress: REQUIRED_TCOIN_TOKEN,
            bootstrapPoolTracked: status.activePoolCount > 0,
            cplTcoinTracked: status.activeTokenCount > 0,
          }
        : undefined,
  };
}
