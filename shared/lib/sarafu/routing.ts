import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress, type Address } from "viem";
import { resolveCitySlug } from "@shared/lib/bia/server";
import type { BiaPoolMapping } from "@shared/lib/bia/types";

function toOptionalAddress(value: unknown): Address | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return undefined;
  }
  return getAddress(trimmed);
}

function mapPoolMappingRow(row: any): BiaPoolMapping {
  return {
    id: row.id,
    biaId: row.bia_id,
    chainId: Number(row.chain_id),
    poolAddress: getAddress(row.pool_address),
    tokenRegistry: toOptionalAddress(row.token_registry),
    tokenLimiter: toOptionalAddress(row.token_limiter),
    quoter: toOptionalAddress(row.quoter),
    feeAddress: toOptionalAddress(row.fee_address),
    mappingStatus: row.mapping_status,
    validationStatus: row.validation_status,
    validationNotes: row.validation_notes ?? undefined,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function resolveActiveBiaPoolMapping(options: {
  supabase: SupabaseClient<any, any, any>;
  biaId: string;
  chainId: number;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("*")
    .eq("bia_id", options.biaId)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve BIA pool mapping: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPoolMappingRow(data);
}

export async function resolveBiaPoolMappingByAddress(options: {
  supabase: SupabaseClient<any, any, any>;
  chainId: number;
  poolAddress: Address;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("*")
    .eq("chain_id", options.chainId)
    .eq("pool_address", options.poolAddress)
    .eq("mapping_status", "active")
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve BIA pool mapping by pool address: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPoolMappingRow(data);
}

export async function resolveActiveUserBia(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
}) {
  const { data, error } = await options.supabase
    .from("user_bia_affiliations")
    .select("bia_id,effective_from,effective_to")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user BIA affiliation: ${error.message}`);
  }

  return data?.bia_id ?? null;
}

export async function resolveCityBiaMappings(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug?: string;
  chainId: number;
}) {
  const citySlug = resolveCitySlug(options.citySlug);

  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("*, bia_registry!inner(city_slug)")
    .eq("bia_registry.city_slug", citySlug)
    .eq("chain_id", options.chainId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to resolve city BIA pool mappings: ${error.message}`);
  }

  return (data ?? []).map(mapPoolMappingRow);
}
