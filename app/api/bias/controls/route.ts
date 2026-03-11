import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import {
  assertAdminOrOperator,
  resolveActiveAppInstanceId,
  resolveCitySlug,
  toNumber,
  userHasAnyRole,
} from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
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

    const { data, error } = await serviceRole
      .from("bia_pool_controls")
      .select("*, bia_registry!inner(city_slug,code,name)")
      .eq("bia_registry.city_slug", citySlug)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load BIA controls: ${error.message}`);
    }

    return NextResponse.json({
      citySlug,
      canAdminister,
      controls: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading controls";
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
      maxDailyRedemption?: number | string | null;
      maxTxAmount?: number | string | null;
      queueOnlyMode?: boolean;
      isFrozen?: boolean;
      reason?: string;
    };

    if (!body.biaId) {
      return NextResponse.json({ error: "biaId is required." }, { status: 400 });
    }

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

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id")
      .eq("id", body.biaId)
      .eq("city_slug", citySlug)
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate BIA control target: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json({ error: "BIA not found for selected city." }, { status: 400 });
    }

    const maxDaily =
      body.maxDailyRedemption == null ? null : toNumber(body.maxDailyRedemption, Number.NaN);
    const maxTx = body.maxTxAmount == null ? null : toNumber(body.maxTxAmount, Number.NaN);

    if (Number.isNaN(maxDaily) || Number.isNaN(maxTx)) {
      return NextResponse.json(
        { error: "maxDailyRedemption/maxTxAmount must be numeric values when provided." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { data: updated, error: upsertError } = await serviceRole
      .from("bia_pool_controls")
      .upsert(
        {
          bia_id: body.biaId,
          max_daily_redemption: maxDaily,
          max_tx_amount: maxTx,
          queue_only_mode: body.queueOnlyMode ?? false,
          is_frozen: body.isFrozen ?? false,
          updated_by: userRow.id,
          updated_at: nowIso,
        },
        { onConflict: "bia_id" }
      )
      .select("*")
      .single();

    if (upsertError) {
      throw new Error(`Failed to update BIA controls: ${upsertError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "bia_controls_updated",
      city_slug: citySlug,
      bia_id: body.biaId,
      actor_user_id: userRow.id,
      reason: body.reason ?? "BIA risk controls updated",
      payload: {
        appInstanceId,
        maxDailyRedemption: maxDaily,
        maxTxAmount: maxTx,
        queueOnlyMode: body.queueOnlyMode ?? false,
        isFrozen: body.isFrozen ?? false,
      },
    });

    return NextResponse.json({ controls: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error updating controls";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
