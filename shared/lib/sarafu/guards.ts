import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { isTokenInSarafuPool } from "@shared/lib/sarafu/client";
import type { BiaPoolMapping } from "@shared/lib/bia/types";

export function assertActiveMapping(mapping: BiaPoolMapping | null): asserts mapping is BiaPoolMapping {
  if (!mapping) {
    throw new Error("No active BIA pool mapping found.");
  }

  if (mapping.mappingStatus !== "active") {
    throw new Error("BIA pool mapping is not active.");
  }

  if (mapping.effectiveTo) {
    throw new Error("BIA pool mapping is no longer effective.");
  }
}

export async function assertPoolTokenSupport(options: {
  chainId: number;
  poolAddress: Address;
  tokenAddress: Address;
  rpcUrl?: string;
}) {
  const isSupported = await isTokenInSarafuPool({
    chainId: options.chainId,
    poolAddress: options.poolAddress,
    tokenAddress: options.tokenAddress,
    rpcUrl: options.rpcUrl,
  });

  if (!isSupported) {
    throw new Error("Mapped pool does not include the requested token in its token registry.");
  }
}

export async function assertBiaPoolNotFrozen(options: {
  supabase: SupabaseClient<any, any, any>;
  biaId: string;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_controls")
    .select("is_frozen")
    .eq("bia_id", options.biaId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate BIA pool controls: ${error.message}`);
  }

  if (data?.is_frozen === true) {
    throw new Error("This BIA pool is currently frozen.");
  }
}

export async function assertStoreNotSuspended(options: {
  supabase: SupabaseClient<any, any, any>;
  storeId: number;
}) {
  const { data, error } = await options.supabase
    .from("store_risk_flags")
    .select("is_suspended")
    .eq("store_id", options.storeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate store risk status: ${error.message}`);
  }

  if (data?.is_suspended === true) {
    throw new Error("This store is currently suspended from redemption operations.");
  }
}

export async function assertPoolRedemptionLimits(options: {
  supabase: SupabaseClient<any, any, any>;
  biaId: string;
  tokenAmount: number;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_controls")
    .select("max_tx_amount,max_daily_redemption,queue_only_mode")
    .eq("bia_id", options.biaId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate pool redemption controls: ${error.message}`);
  }

  if (!data) {
    return;
  }

  if (typeof data.max_tx_amount === "number" && data.max_tx_amount > 0 && options.tokenAmount > data.max_tx_amount) {
    throw new Error(`Requested redemption exceeds BIA max_tx_amount (${data.max_tx_amount}).`);
  }

  if (typeof data.max_daily_redemption === "number" && data.max_daily_redemption > 0) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { data: pendingRows, error: pendingError } = await options.supabase
      .from("pool_redemption_requests")
      .select("token_amount")
      .eq("bia_id", options.biaId)
      .gte("created_at", startOfDay.toISOString())
      .in("status", ["pending", "approved", "settled"]);

    if (pendingError) {
      throw new Error(`Failed to evaluate max_daily_redemption: ${pendingError.message}`);
    }

    const total = (pendingRows ?? []).reduce((sum, row) => {
      const value = typeof row.token_amount === "number" ? row.token_amount : Number(row.token_amount ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    if (total + options.tokenAmount > data.max_daily_redemption) {
      throw new Error(`Requested redemption exceeds BIA max_daily_redemption (${data.max_daily_redemption}).`);
    }
  }
}
