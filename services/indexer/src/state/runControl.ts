import type { SupabaseClient } from "@supabase/supabase-js";
import { INDEXER_COOLDOWN_SECONDS } from "../config";
import type { IndexerScopeStatus, IndexerSource } from "../types";

export function normaliseCitySlug(citySlug: string): string {
  const value = citySlug.trim().toLowerCase();
  if (!value) {
    throw new Error("City slug is required.");
  }
  return value;
}

export function buildScopeKey(citySlug: string, chainId: number): string {
  return `${normaliseCitySlug(citySlug)}:${chainId}`;
}

export async function tryStartRun(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  citySlug: string;
  chainId: number;
  cooldownSeconds?: number;
}): Promise<{
  started: boolean;
  skipped: boolean;
  reason?: string;
  nextEligibleAt?: string;
}> {
  const { supabase, scopeKey, citySlug, chainId } = options;
  const cooldownSeconds = options.cooldownSeconds ?? INDEXER_COOLDOWN_SECONDS;

  const { data, error } = await supabase.rpc("indexer_try_start_run", {
    p_scope_key: scopeKey,
    p_city_slug: citySlug,
    p_chain_id: chainId,
    p_cooldown_seconds: cooldownSeconds,
  });

  if (error) {
    throw new Error(`Failed to start indexer run: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Indexer start RPC returned no result.");
  }

  return {
    started: Boolean(row.started),
    skipped: Boolean(row.skipped),
    reason: row.reason ?? undefined,
    nextEligibleAt: row.next_eligible_at ?? undefined,
  };
}

export async function completeRun(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  status: "success" | "error" | "skipped";
  errorMessage?: string;
  cooldownSeconds?: number;
}) {
  const { supabase, scopeKey, status, errorMessage } = options;
  const cooldownSeconds = options.cooldownSeconds ?? INDEXER_COOLDOWN_SECONDS;

  const { error } = await supabase.rpc("indexer_complete_run", {
    p_scope_key: scopeKey,
    p_status: status,
    p_error: errorMessage ?? null,
    p_cooldown_seconds: cooldownSeconds,
  });

  if (error) {
    throw new Error(`Failed to complete indexer run: ${error.message}`);
  }
}

export async function getCheckpoint(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  source: IndexerSource;
}): Promise<{ lastBlock: number; lastTxHash: string | null } | null> {
  const { supabase, scopeKey, source } = options;
  const { data, error } = await supabase
    .schema("indexer")
    .from("checkpoints")
    .select("last_block,last_tx_hash")
    .eq("scope_key", scopeKey)
    .eq("source", source)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read ${source} checkpoint: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    lastBlock: Number(data.last_block ?? 0),
    lastTxHash: data.last_tx_hash ?? null,
  };
}

export async function upsertCheckpoint(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  source: IndexerSource;
  lastBlock: number;
  lastTxHash?: string | null;
}) {
  const { supabase, scopeKey, source, lastBlock, lastTxHash } = options;
  const { error } = await supabase
    .schema("indexer")
    .from("checkpoints")
    .upsert(
      {
        scope_key: scopeKey,
        source,
        last_block: lastBlock,
        last_tx_hash: lastTxHash ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope_key,source" }
    );

  if (error) {
    throw new Error(`Failed to upsert ${source} checkpoint: ${error.message}`);
  }
}

export async function getScopeStatus(options: {
  supabase: SupabaseClient<any, any, any>;
  scopeKey: string;
  citySlug: string;
  chainId: number;
}): Promise<IndexerScopeStatus> {
  const { supabase, scopeKey, citySlug, chainId } = options;

  const [{ data: runControl, error: runControlError }, { data: checkpoints, error: checkpointsError }] =
    await Promise.all([
      supabase
        .schema("indexer")
        .from("run_control")
        .select(
          "last_started_at,last_completed_at,last_status,last_error,next_eligible_start_at,next_eligible_complete_at,updated_at"
        )
        .eq("scope_key", scopeKey)
        .maybeSingle(),
      supabase
        .schema("indexer")
        .from("checkpoints")
        .select("source,last_block,last_tx_hash,updated_at")
        .eq("scope_key", scopeKey)
        .order("source", { ascending: true }),
    ]);

  if (runControlError) {
    throw new Error(`Failed to read run control status: ${runControlError.message}`);
  }

  if (checkpointsError) {
    throw new Error(`Failed to read checkpoints: ${checkpointsError.message}`);
  }

  const { data: activePools, error: poolsError } = await supabase
    .schema("indexer")
    .from("pool_links")
    .select("pool_address")
    .eq("city_slug", citySlug)
    .eq("chain_id", chainId)
    .eq("is_active", true);

  if (poolsError) {
    throw new Error(`Failed to read active pools: ${poolsError.message}`);
  }

  const poolAddresses = (activePools ?? []).map((row) => row.pool_address as string);
  let activeTokenCount = 0;

  if (poolAddresses.length > 0) {
    const { data: activePoolTokens, error: poolTokensError } = await supabase
      .schema("indexer")
      .from("pool_tokens")
      .select("token_address")
      .in("pool_address", poolAddresses);

    if (poolTokensError) {
      throw new Error(`Failed to read active pool tokens: ${poolTokensError.message}`);
    }

    const tokenSet = new Set((activePoolTokens ?? []).map((row) => String(row.token_address).toLowerCase()));
    activeTokenCount = tokenSet.size;
  }

  return {
    scopeKey,
    citySlug,
    chainId,
    runControl: runControl
      ? {
          lastStartedAt: runControl.last_started_at,
          lastCompletedAt: runControl.last_completed_at,
          lastStatus: runControl.last_status,
          lastError: runControl.last_error,
          nextEligibleStartAt: runControl.next_eligible_start_at,
          nextEligibleCompleteAt: runControl.next_eligible_complete_at,
          updatedAt: runControl.updated_at,
        }
      : null,
    checkpoints: (checkpoints ?? []).map((checkpoint) => ({
      source: checkpoint.source,
      lastBlock: Number(checkpoint.last_block ?? 0),
      lastTxHash: checkpoint.last_tx_hash,
      updatedAt: checkpoint.updated_at,
    })),
    activePoolCount: activePools?.length ?? 0,
    activeTokenCount,
  };
}
