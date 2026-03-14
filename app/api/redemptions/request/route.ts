import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertStoreAccess, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { resolveActiveBiaPoolMapping } from "@shared/lib/sarafu/routing";
import {
  assertActiveMapping,
  assertBiaPoolNotFrozen,
  assertPoolRedemptionLimits,
  assertStoreNotSuspended,
} from "@shared/lib/sarafu/guards";

const ALLOWED_SETTLEMENT_ASSETS = new Set(["CAD", "TTC", "USDC"]);

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      storeId?: number;
      chainId?: number | string;
      tokenAmount?: number | string;
      settlementAsset?: string;
      settlementAmount?: number | string;
      metadata?: Record<string, unknown>;
    };

    const storeId = Number(body.storeId ?? 0);
    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "storeId must be a positive number." }, { status: 400 });
    }

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    await assertStoreAccess({
      supabase: serviceRole,
      userId: Number(userRow.id),
      storeId,
      appInstanceId,
    });

    const { data: scopedStore, error: scopedStoreError } = await serviceRole
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .limit(1)
      .maybeSingle();

    if (scopedStoreError) {
      throw new Error(`Failed to validate store scope: ${scopedStoreError.message}`);
    }

    if (!scopedStore) {
      return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
    }

    const chainId = Math.max(1, Math.trunc(toNumber(body.chainId, 42220)));
    const tokenAmount = toNumber(body.tokenAmount, 0);
    const settlementAmount =
      body.settlementAmount == null ? null : toNumber(body.settlementAmount, Number.NaN);

    if (!(tokenAmount > 0)) {
      return NextResponse.json({ error: "tokenAmount must be a positive number." }, { status: 400 });
    }

    if (settlementAmount !== null && Number.isNaN(settlementAmount)) {
      return NextResponse.json({ error: "settlementAmount must be numeric when provided." }, { status: 400 });
    }

    const settlementAsset = String(body.settlementAsset ?? "CAD").trim().toUpperCase();
    if (!ALLOWED_SETTLEMENT_ASSETS.has(settlementAsset)) {
      return NextResponse.json(
        { error: `settlementAsset must be one of ${Array.from(ALLOWED_SETTLEMENT_ASSETS).join(", ")}.` },
        { status: 400 }
      );
    }

    const { data: storeBia, error: storeBiaError } = await serviceRole
      .from("store_bia_affiliations")
      .select("bia_id")
      .eq("store_id", storeId)
      .is("effective_to", null)
      .limit(1)
      .maybeSingle();

    if (storeBiaError) {
      throw new Error(`Failed to resolve store BIA affiliation: ${storeBiaError.message}`);
    }

    if (!storeBia?.bia_id) {
      return NextResponse.json(
        { error: "Store does not have an active BIA affiliation." },
        { status: 400 }
      );
    }

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id,city_slug,status")
      .eq("id", storeBia.bia_id)
      .eq("city_slug", citySlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate store BIA: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json(
        { error: "Store BIA is inactive or not mapped to this city." },
        { status: 400 }
      );
    }

    const mapping = await resolveActiveBiaPoolMapping({
      supabase: serviceRole,
      biaId: storeBia.bia_id,
      chainId,
    });
    assertActiveMapping(mapping);

    await Promise.all([
      assertBiaPoolNotFrozen({
        supabase: serviceRole,
        biaId: storeBia.bia_id,
      }),
      assertStoreNotSuspended({
        supabase: serviceRole,
        storeId,
      }),
      assertPoolRedemptionLimits({
        supabase: serviceRole,
        biaId: storeBia.bia_id,
        tokenAmount,
      }),
    ]);

    const nowIso = new Date().toISOString();

    const { data: requestRow, error: requestError } = await serviceRole
      .from("pool_redemption_requests")
      .insert({
        store_id: storeId,
        requester_user_id: userRow.id,
        bia_id: storeBia.bia_id,
        chain_id: chainId,
        pool_address: mapping.poolAddress,
        settlement_asset: settlementAsset,
        token_amount: tokenAmount,
        settlement_amount: settlementAmount,
        status: "pending",
        metadata: {
          ...(body.metadata ?? {}),
          appInstanceId,
          queue_only_mode: true,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (requestError) {
      throw new Error(`Failed to create redemption request: ${requestError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "redemption_requested",
      city_slug: citySlug,
      bia_id: storeBia.bia_id,
      store_id: storeId,
      actor_user_id: userRow.id,
      reason: "Merchant redemption request created",
      payload: {
        appInstanceId,
        chainId,
        poolAddress: mapping.poolAddress,
        tokenAmount,
        settlementAsset,
        settlementAmount,
      },
    });

    return NextResponse.json({
      request: requestRow,
      routing: {
        chainId,
        biaId: storeBia.bia_id,
        poolAddress: mapping.poolAddress,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error creating redemption request";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("No active BIA pool mapping")
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
