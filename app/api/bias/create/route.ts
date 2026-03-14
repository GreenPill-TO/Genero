import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      code?: string;
      name?: string;
      centerLat?: number | string;
      centerLng?: number | string;
      metadata?: Record<string, unknown>;
      status?: "active" | "inactive";
      controls?: {
        maxDailyRedemption?: number | string;
        maxTxAmount?: number | string;
        queueOnlyMode?: boolean;
        isFrozen?: boolean;
      };
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

    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    const centerLat = toNumber(body.centerLat, Number.NaN);
    const centerLng = toNumber(body.centerLng, Number.NaN);

    if (!code || !name) {
      return NextResponse.json({ error: "code and name are required." }, { status: 400 });
    }

    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return NextResponse.json(
        { error: "centerLat and centerLng are required numeric values." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: created, error: createError } = await serviceRole
      .from("bia_registry")
      .insert({
        city_slug: citySlug,
        code,
        name,
        center_lat: centerLat,
        center_lng: centerLng,
        status: body.status ?? "active",
        metadata: body.metadata ?? {},
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (createError) {
      throw new Error(`Failed to create BIA: ${createError.message}`);
    }

    if (body.controls) {
      const maxDaily =
        body.controls.maxDailyRedemption == null
          ? null
          : toNumber(body.controls.maxDailyRedemption, Number.NaN);
      const maxTx =
        body.controls.maxTxAmount == null ? null : toNumber(body.controls.maxTxAmount, Number.NaN);

      if (Number.isNaN(maxDaily) || Number.isNaN(maxTx)) {
        return NextResponse.json(
          { error: "controls.maxDailyRedemption/maxTxAmount must be numeric when provided." },
          { status: 400 }
        );
      }

      const { error: controlsError } = await serviceRole.from("bia_pool_controls").upsert(
        {
          bia_id: created.id,
          max_daily_redemption: maxDaily,
          max_tx_amount: maxTx,
          queue_only_mode: body.controls.queueOnlyMode ?? false,
          is_frozen: body.controls.isFrozen ?? false,
          updated_by: userRow.id,
          updated_at: nowIso,
        },
        { onConflict: "bia_id" }
      );

      if (controlsError) {
        throw new Error(`Failed to configure BIA controls: ${controlsError.message}`);
      }
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "bia_created",
      city_slug: citySlug,
      bia_id: created.id,
      actor_user_id: userRow.id,
      reason: "BIA registry entry created",
      payload: {
        appInstanceId,
        code,
        name,
      },
    });

    return NextResponse.json({ bia: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error creating BIA";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
