import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress, isAddress, type Address } from "viem";
import type { BiaScopeSummary, NormalizedEvent, TrackedPoolLink } from "./types";

function toLowerAddress(value: unknown): string | null {
  if (typeof value !== "string" || !isAddress(value)) {
    return null;
  }

  return getAddress(value).toLowerCase();
}

function toNumeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return 0;
}

function pickNumeric(payload: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (key in payload) {
      return toNumeric(payload[key]);
    }
  }
  return 0;
}

function normalizeAddressOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  const checksummed = getAddress(trimmed);
  if (checksummed.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return checksummed.toLowerCase();
}

function buildContractToPoolMap(pools: TrackedPoolLink[]): Map<string, string> {
  const contractToPool = new Map<string, string>();
  const tokenCandidateMap = new Map<string, Set<string>>();

  for (const pool of pools) {
    const poolLower = pool.poolAddress.toLowerCase();

    const directContracts = [
      pool.poolAddress,
      pool.tokenRegistry,
      pool.tokenLimiter,
      pool.quoter,
      pool.ownerAddress,
      pool.feeAddress,
    ].filter((value): value is Address => Boolean(value));

    for (const contractAddress of directContracts) {
      contractToPool.set(contractAddress.toLowerCase(), poolLower);
    }

    for (const tokenAddress of pool.tokenAddresses ?? []) {
      const tokenLower = tokenAddress.toLowerCase();
      const holder = tokenCandidateMap.get(tokenLower) ?? new Set<string>();
      holder.add(poolLower);
      tokenCandidateMap.set(tokenLower, holder);
    }
  }

  for (const [tokenAddress, poolSet] of Array.from(tokenCandidateMap.entries())) {
    if (poolSet.size === 1) {
      contractToPool.set(tokenAddress, Array.from(poolSet)[0]);
    }
  }

  return contractToPool;
}

export async function syncBiaMappingValidation(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
  activePools: TrackedPoolLink[];
}) {
  const nowIso = new Date().toISOString();

  const discoveredByPool = new Map<string, TrackedPoolLink>();
  for (const pool of options.activePools) {
    discoveredByPool.set(pool.poolAddress.toLowerCase(), pool);
  }

  const { data: rows, error } = await options.supabase
    .from("bia_pool_mappings")
    .select(
      "id,pool_address,token_registry,token_limiter,quoter,fee_address,validation_status,validation_notes,bia_registry!inner(city_slug)"
    )
    .eq("bia_registry.city_slug", options.citySlug)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null);

  if (error) {
    throw new Error(`Failed to load BIA pool mappings for validation sync: ${error.message}`);
  }

  const updates: Array<{ id: string; validation_status: string; validation_notes: string | null }> = [];
  const mappedPoolSet = new Set<string>();

  for (const row of rows ?? []) {
    const mappingId = String((row as any).id ?? "").trim();
    const mappedPool = normalizeAddressOrNull((row as any).pool_address);
    if (!mappingId || !mappedPool) {
      continue;
    }

    mappedPoolSet.add(mappedPool);
    const discoveredPool = discoveredByPool.get(mappedPool);

    let nextStatus: "valid" | "stale" | "mismatch" = "valid";
    let nextNotes: string | null = null;

    if (!discoveredPool) {
      nextStatus = "stale";
      nextNotes = "Mapped pool was not found in latest indexer discovery pass.";
    } else {
      const expectedTokenRegistry = normalizeAddressOrNull((row as any).token_registry);
      const expectedTokenLimiter = normalizeAddressOrNull((row as any).token_limiter);
      const expectedQuoter = normalizeAddressOrNull((row as any).quoter);
      const expectedFeeAddress = normalizeAddressOrNull((row as any).fee_address);

      const actualTokenRegistry = discoveredPool.tokenRegistry?.toLowerCase() ?? null;
      const actualTokenLimiter = discoveredPool.tokenLimiter?.toLowerCase() ?? null;
      const actualQuoter = discoveredPool.quoter?.toLowerCase() ?? null;
      const actualFeeAddress = discoveredPool.feeAddress?.toLowerCase() ?? null;

      const mismatches: string[] = [];
      if (expectedTokenRegistry && expectedTokenRegistry !== actualTokenRegistry) {
        mismatches.push("token_registry");
      }
      if (expectedTokenLimiter && expectedTokenLimiter !== actualTokenLimiter) {
        mismatches.push("token_limiter");
      }
      if (expectedQuoter && expectedQuoter !== actualQuoter) {
        mismatches.push("quoter");
      }
      if (expectedFeeAddress && expectedFeeAddress !== actualFeeAddress) {
        mismatches.push("fee_address");
      }

      if (mismatches.length > 0) {
        nextStatus = "mismatch";
        nextNotes = `Mismatch detected for ${mismatches.join(", ")} against discovered pool components.`;
      }
    }

    const currentStatus = String((row as any).validation_status ?? "unknown").toLowerCase();
    const currentNotes = ((row as any).validation_notes as string | null) ?? null;

    if (currentStatus !== nextStatus || currentNotes !== nextNotes) {
      updates.push({
        id: mappingId,
        validation_status: nextStatus,
        validation_notes: nextNotes,
      });
    }
  }

  for (const update of updates) {
    const { error: updateError } = await options.supabase
      .from("bia_pool_mappings")
      .update({
        validation_status: update.validation_status,
        validation_notes: update.validation_notes,
        updated_at: nowIso,
      })
      .eq("id", update.id);

    if (updateError) {
      throw new Error(`Failed to update mapping validation status: ${updateError.message}`);
    }
  }

  const updatedStatusById = new Map(updates.map((update) => [update.id, update.validation_status]));
  let staleMappings = 0;
  for (const row of rows ?? []) {
    const rowId = String((row as any).id ?? "");
    const status = (
      updatedStatusById.get(rowId) ??
      String((row as any).validation_status ?? "unknown")
    ).toLowerCase();
    if (status === "stale" || status === "mismatch") {
      staleMappings += 1;
    }
  }

  let unmappedPools = 0;
  for (const discoveredPoolAddress of Array.from(discoveredByPool.keys())) {
    if (!mappedPoolSet.has(discoveredPoolAddress)) {
      unmappedPools += 1;
    }
  }

  return {
    mappedPools: mappedPoolSet.size,
    unmappedPools,
    staleMappings,
    updatedMappings: updates.length,
  };
}

export async function deriveBiaRollupsAndRisk(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  citySlug: string;
  chainId: number;
  fromBlock: number;
  toBlock: number;
  activePools: TrackedPoolLink[];
}) {
  const contractToPool = buildContractToPoolMap(options.activePools);

  const { data: mappingRows, error: mappingError } = await options.supabase
    .from("bia_pool_mappings")
    .select("bia_id,pool_address,bia_registry!inner(city_slug)")
    .eq("bia_registry.city_slug", options.citySlug)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null);

  if (mappingError) {
    throw new Error(`Failed to load active BIA mappings for rollups: ${mappingError.message}`);
  }

  const poolToBia = new Map<string, string>();
  const trackedBiaIds = new Set<string>();

  for (const row of mappingRows ?? []) {
    const poolLower = toLowerAddress((row as any).pool_address);
    const biaId = String((row as any).bia_id ?? "").trim();
    if (!poolLower || !biaId) {
      continue;
    }
    poolToBia.set(poolLower, biaId);
    trackedBiaIds.add(biaId);
  }

  const { data: rawEvents, error: rawError } = await options.supabase
    .schema("indexer")
    .from("raw_events")
    .select("block_number,tx_hash,contract_address,transaction_type,payload")
    .eq("scope_key", options.scopeKey)
    .gte("block_number", options.fromBlock)
    .lte("block_number", options.toBlock)
    .order("block_number", { ascending: true })
    .order("tx_hash", { ascending: true });

  if (rawError) {
    throw new Error(`Failed to load raw events for BIA rollups: ${rawError.message}`);
  }

  const aggregate = new Map<
    string,
    {
      scope_key: string;
      bia_id: string;
      chain_id: number;
      pool_address: string;
      block_number: number;
      transaction_type: string;
      event_count: number;
      volume_in: number;
      volume_out: number;
      last_tx_hash: string;
      updated_at: string;
    }
  >();

  const nowIso = new Date().toISOString();

  for (const row of rawEvents ?? []) {
    const contractAddress = toLowerAddress((row as any).contract_address);
    if (!contractAddress) {
      continue;
    }

    const mappedPoolAddress = contractToPool.get(contractAddress);
    if (!mappedPoolAddress) {
      continue;
    }

    const biaId = poolToBia.get(mappedPoolAddress);
    if (!biaId) {
      continue;
    }

    trackedBiaIds.add(biaId);

    const txType = String((row as any).transaction_type ?? "UNKNOWN");
    const blockNumber = Number((row as any).block_number ?? 0);
    const txHash = String((row as any).tx_hash ?? "");
    const payload = (((row as any).payload ?? {}) as Record<string, unknown>) ?? {};

    const key = `${biaId}:${mappedPoolAddress}:${blockNumber}:${txType}`;

    const inVolume =
      txType === "POOL_SWAP"
        ? pickNumeric(payload, ["amountIn", "inValue"])
        : txType === "POOL_DEPOSIT"
          ? pickNumeric(payload, ["amountIn", "inValue", "value", "_value"])
          : pickNumeric(payload, ["value", "_value"]);

    const outVolume =
      txType === "POOL_SWAP"
        ? pickNumeric(payload, ["amountOut", "outValue"])
        : 0;

    const current = aggregate.get(key);

    if (!current) {
      aggregate.set(key, {
        scope_key: options.scopeKey,
        bia_id: biaId,
        chain_id: options.chainId,
        pool_address: getAddress(mappedPoolAddress),
        block_number: blockNumber,
        transaction_type: txType,
        event_count: 1,
        volume_in: inVolume,
        volume_out: outVolume,
        last_tx_hash: txHash,
        updated_at: nowIso,
      });
      continue;
    }

    current.event_count += 1;
    current.volume_in += inVolume;
    current.volume_out += outVolume;
    current.last_tx_hash = txHash || current.last_tx_hash;
    current.updated_at = nowIso;
  }

  const { error: deleteError } = await options.supabase
    .schema("indexer")
    .from("bia_event_rollups")
    .delete()
    .eq("scope_key", options.scopeKey)
    .gte("block_number", options.fromBlock)
    .lte("block_number", options.toBlock);

  if (deleteError) {
    throw new Error(`Failed to refresh BIA rollup range: ${deleteError.message}`);
  }

  const rollupRows = Array.from(aggregate.values());
  if (rollupRows.length > 0) {
    const { error: rollupError } = await options.supabase
      .schema("indexer")
      .from("bia_event_rollups")
      .insert(rollupRows);

    if (rollupError) {
      throw new Error(`Failed to insert BIA rollups: ${rollupError.message}`);
    }
  }

  const biaIds = Array.from(trackedBiaIds);

  const pendingByBia = new Map<string, { count: number; amount: number }>();
  let totalPendingAmount = 0;

  if (biaIds.length > 0) {
    const { data: pendingRows, error: pendingError } = await options.supabase
      .from("pool_redemption_requests")
      .select("bia_id,token_amount,status")
      .in("bia_id", biaIds)
      .in("status", ["pending", "approved"]);

    if (pendingError) {
      throw new Error(`Failed to load pending redemption pressure for risk signals: ${pendingError.message}`);
    }

    for (const row of pendingRows ?? []) {
      const biaId = String((row as any).bia_id ?? "").trim();
      if (!biaId) {
        continue;
      }
      const tokenAmount = toNumeric((row as any).token_amount);
      const current = pendingByBia.get(biaId) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += tokenAmount;
      pendingByBia.set(biaId, current);
      totalPendingAmount += tokenAmount;
    }
  }

  const maxRecentBlock = Math.max(options.toBlock, 0);
  const recentBlockFloor = Math.max(0, maxRecentBlock - 50_000);

  const recentSwapByBia = new Map<string, number>();
  if (biaIds.length > 0) {
    const { data: recentRows, error: recentError } = await options.supabase
      .schema("indexer")
      .from("bia_event_rollups")
      .select("bia_id,transaction_type,volume_in,volume_out")
      .eq("scope_key", options.scopeKey)
      .in("bia_id", biaIds)
      .gte("block_number", recentBlockFloor);

    if (recentError) {
      throw new Error(`Failed to read recent rollups for risk signals: ${recentError.message}`);
    }

    for (const row of recentRows ?? []) {
      if (String((row as any).transaction_type) !== "POOL_SWAP") {
        continue;
      }
      const biaId = String((row as any).bia_id ?? "").trim();
      if (!biaId) {
        continue;
      }
      const volumeIn = toNumeric((row as any).volume_in);
      const volumeOut = toNumeric((row as any).volume_out);
      const current = recentSwapByBia.get(biaId) ?? 0;
      recentSwapByBia.set(biaId, current + volumeIn + volumeOut);
    }
  }

  const signalRows = biaIds.map((biaId) => {
    const pending = pendingByBia.get(biaId) ?? { count: 0, amount: 0 };
    const recentSwapVolume = recentSwapByBia.get(biaId) ?? 0;
    const redemptionPressure = pending.amount / Math.max(1, recentSwapVolume);
    const concentrationScore =
      totalPendingAmount > 0 ? pending.amount / totalPendingAmount : 0;

    let stressLevel: "low" | "medium" | "high" = "low";
    if (redemptionPressure >= 1 || pending.count >= 25) {
      stressLevel = "high";
    } else if (redemptionPressure >= 0.35 || pending.count >= 10) {
      stressLevel = "medium";
    }

    return {
      scope_key: options.scopeKey,
      bia_id: biaId,
      chain_id: options.chainId,
      pending_redemption_count: pending.count,
      pending_redemption_amount: pending.amount,
      recent_swap_volume: recentSwapVolume,
      redemption_pressure: redemptionPressure,
      concentration_score: concentrationScore,
      stress_level: stressLevel,
      generated_at: nowIso,
    };
  });

  if (signalRows.length > 0) {
    const { error: signalError } = await options.supabase
      .schema("indexer")
      .from("bia_risk_signals")
      .upsert(signalRows, { onConflict: "scope_key,bia_id,chain_id" });

    if (signalError) {
      throw new Error(`Failed to upsert BIA risk signals: ${signalError.message}`);
    }
  }

  return {
    rollupRows: rollupRows.length,
    riskSignals: signalRows.length,
  };
}

export async function buildBiaScopeSummary(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
}): Promise<BiaScopeSummary> {
  const [activeBiasResult, mappingRowsResult, activePoolRowsResult, activityRowsResult] = await Promise.all([
    options.supabase
      .from("bia_registry")
      .select("id")
      .eq("city_slug", options.citySlug)
      .eq("status", "active"),
    options.supabase
      .from("bia_pool_mappings")
      .select("bia_id,pool_address,validation_status,bia_registry!inner(city_slug)")
      .eq("bia_registry.city_slug", options.citySlug)
      .eq("chain_id", options.chainId)
      .eq("mapping_status", "active")
      .is("effective_to", null),
    options.supabase
      .schema("indexer")
      .from("pool_links")
      .select("pool_address")
      .eq("city_slug", options.citySlug)
      .eq("chain_id", options.chainId)
      .eq("is_active", true),
    options.supabase
      .from("v_bia_activity_summary")
      .select("bia_id,code,name,last_indexed_block,indexed_event_count")
      .eq("city_slug", options.citySlug),
  ]);

  if (activeBiasResult.error) {
    throw new Error(`Failed to count active BIAs: ${activeBiasResult.error.message}`);
  }
  if (mappingRowsResult.error) {
    throw new Error(`Failed to load BIA mappings for status summary: ${mappingRowsResult.error.message}`);
  }
  if (activePoolRowsResult.error) {
    throw new Error(`Failed to load active discovered pools for status summary: ${activePoolRowsResult.error.message}`);
  }
  if (activityRowsResult.error) {
    throw new Error(`Failed to load BIA activity summary: ${activityRowsResult.error.message}`);
  }

  const mappedPoolSet = new Set(
    (mappingRowsResult.data ?? [])
      .map((row: any) => normalizeAddressOrNull(row.pool_address))
      .filter((value: string | null): value is string => Boolean(value))
  );

  const discoveredPoolSet = new Set(
    (activePoolRowsResult.data ?? [])
      .map((row: any) => normalizeAddressOrNull(row.pool_address))
      .filter((value: string | null): value is string => Boolean(value))
  );

  let unmappedPools = 0;
  for (const discoveredPoolAddress of Array.from(discoveredPoolSet)) {
    if (!mappedPoolSet.has(discoveredPoolAddress)) {
      unmappedPools += 1;
    }
  }

  let staleMappings = 0;
  for (const row of mappingRowsResult.data ?? []) {
    const status = String((row as any).validation_status ?? "unknown").toLowerCase();
    if (status === "stale" || status === "mismatch") {
      staleMappings += 1;
    }
  }

  const lastActivityByBia = (activityRowsResult.data ?? []).map((row: any) => ({
    biaId: String(row.bia_id),
    biaCode: String(row.code ?? ""),
    biaName: String(row.name ?? ""),
    lastIndexedBlock:
      row.last_indexed_block == null ? null : Number(row.last_indexed_block),
    indexedEventCount: Number(row.indexed_event_count ?? 0),
  }));

  return {
    activeBias: (activeBiasResult.data ?? []).length,
    mappedPools: mappedPoolSet.size,
    unmappedPools,
    staleMappings,
    lastActivityByBia,
  };
}
