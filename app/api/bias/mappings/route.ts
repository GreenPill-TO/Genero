import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { runIndexerTouch } from "@services/indexer/src";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import {
  assertAdminOrOperator,
  resolveActiveAppInstanceId,
  resolveCitySlug,
  toNumber,
  userHasAnyRole,
} from "@shared/lib/bia/server";

type MappingStatus = "active" | "inactive" | "pending";

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    return null;
  }
  const normalized = getAddress(trimmed);
  if (normalized.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return normalized;
}

async function buildMappingHealth(options: {
  citySlug: string;
  chainId: number;
  serviceRole: any;
}) {
  const { citySlug, chainId, serviceRole } = options;

  const [activeMappingsResult, activePoolsResult] = await Promise.all([
    serviceRole
      .from("bia_pool_mappings")
      .select("pool_address,validation_status,bia_id,bia_registry!inner(city_slug,code,name)")
      .eq("bia_registry.city_slug", citySlug)
      .eq("chain_id", chainId)
      .eq("mapping_status", "active")
      .is("effective_to", null),
    serviceRole
      .schema("indexer")
      .from("pool_links")
      .select("pool_address")
      .eq("city_slug", citySlug)
      .eq("chain_id", chainId)
      .eq("is_active", true),
  ]);

  if (activeMappingsResult.error) {
    throw new Error(`Failed to load active mappings: ${activeMappingsResult.error.message}`);
  }

  if (activePoolsResult.error) {
    throw new Error(`Failed to load discovered pools: ${activePoolsResult.error.message}`);
  }

  const mappedPoolSet = new Set(
    (activeMappingsResult.data ?? []).map((row: any) => String(row.pool_address).toLowerCase())
  );
  const discoveredPoolSet = new Set(
    (activePoolsResult.data ?? []).map((row: any) => String(row.pool_address).toLowerCase())
  );

  let staleMappings = 0;
  for (const row of activeMappingsResult.data ?? []) {
    const status = String(row.validation_status ?? "unknown").toLowerCase();
    if (status === "stale" || status === "mismatch") {
      staleMappings += 1;
    }
  }

  let unmappedPools = 0;
  for (const poolAddress of Array.from(discoveredPoolSet)) {
    if (!mappedPoolSet.has(poolAddress)) {
      unmappedPools += 1;
    }
  }

  return {
    mappedPools: mappedPoolSet.size,
    discoveredPools: discoveredPoolSet.size,
    unmappedPools,
    staleMappings,
  };
}

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const chainId = Math.max(1, Math.trunc(toNumber(url.searchParams.get("chainId"), 42220)));
    const includeHealth = url.searchParams.get("includeHealth") !== "false";

    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const canAdminister = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    const { data: mappings, error: mappingError } = await serviceRole
      .from("bia_pool_mappings")
      .select("*, bia_registry!inner(city_slug,code,name)")
      .eq("bia_registry.city_slug", citySlug)
      .eq("chain_id", chainId)
      .order("updated_at", { ascending: false });

    if (mappingError) {
      throw new Error(`Failed to load BIA mappings: ${mappingError.message}`);
    }

    let health = null;
    if (includeHealth) {
      health = await buildMappingHealth({
        citySlug,
        chainId,
        serviceRole,
      });
    }

    return NextResponse.json({
      citySlug,
      chainId,
      canAdminister,
      mappings: mappings ?? [],
      health,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading mappings";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      biaId?: string;
      chainId?: number | string;
      poolAddress?: string;
      tokenRegistry?: string;
      tokenLimiter?: string;
      quoter?: string;
      feeAddress?: string;
      mappingStatus?: MappingStatus;
      effectiveFrom?: string;
      validationNotes?: string;
      forceTouch?: boolean;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    await assertAdminOrOperator({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const chainId = Math.max(1, Math.trunc(toNumber(body.chainId, 42220)));
    const mappingStatus: MappingStatus = body.mappingStatus ?? "active";

    if (!body.biaId) {
      return NextResponse.json({ error: "biaId is required." }, { status: 400 });
    }

    const poolAddress = normalizeAddress(body.poolAddress);
    if (!poolAddress) {
      return NextResponse.json({ error: "poolAddress must be a valid 0x address." }, { status: 400 });
    }

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id,city_slug")
      .eq("id", body.biaId)
      .eq("city_slug", citySlug)
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate BIA: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json({ error: "BIA not found for selected city." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (mappingStatus === "active") {
      const { error: closeByBiaError } = await serviceRole
        .from("bia_pool_mappings")
        .update({ mapping_status: "inactive", effective_to: nowIso, updated_at: nowIso })
        .eq("bia_id", body.biaId)
        .eq("chain_id", chainId)
        .eq("mapping_status", "active")
        .is("effective_to", null);

      if (closeByBiaError) {
        throw new Error(`Failed to retire previous BIA mapping: ${closeByBiaError.message}`);
      }

      const { error: closeByPoolError } = await serviceRole
        .from("bia_pool_mappings")
        .update({ mapping_status: "inactive", effective_to: nowIso, updated_at: nowIso })
        .eq("chain_id", chainId)
        .eq("pool_address", poolAddress)
        .eq("mapping_status", "active")
        .is("effective_to", null);

      if (closeByPoolError) {
        throw new Error(`Failed to retire previous pool mapping: ${closeByPoolError.message}`);
      }
    }

    const { data: inserted, error: insertError } = await serviceRole
      .from("bia_pool_mappings")
      .insert({
        bia_id: body.biaId,
        chain_id: chainId,
        pool_address: poolAddress,
        token_registry: normalizeAddress(body.tokenRegistry),
        token_limiter: normalizeAddress(body.tokenLimiter),
        quoter: normalizeAddress(body.quoter),
        fee_address: normalizeAddress(body.feeAddress),
        mapping_status: mappingStatus,
        validation_status: "unknown",
        validation_notes: body.validationNotes ?? null,
        effective_from: body.effectiveFrom ?? nowIso,
        effective_to: mappingStatus === "active" ? null : nowIso,
        created_by: userRow.id,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to create BIA mapping: ${insertError.message}`);
    }

    let touchResult: unknown = null;
    if (body.forceTouch === true) {
      touchResult = await runIndexerTouch({
        supabase: serviceRole,
        citySlug,
      });
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "bia_pool_mapping_upserted",
      city_slug: citySlug,
      bia_id: body.biaId,
      actor_user_id: userRow.id,
      reason: "BIA pool mapping updated",
      payload: {
        appInstanceId,
        chainId,
        poolAddress,
        mappingStatus,
        forceTouch: body.forceTouch === true,
      },
    });

    return NextResponse.json({
      mapping: inserted,
      indexerTouch: touchResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error upserting mapping";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
