import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      storeId?: number;
      isSuspended?: boolean;
      reason?: string;
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

    await assertAdminOrOperator({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const { data: storeRow, error: storeError } = await serviceRole
      .from("stores")
      .select("id,app_instance_id")
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Failed to validate store: ${storeError.message}`);
    }

    if (!storeRow) {
      return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    const { data: updated, error: upsertError } = await serviceRole
      .from("store_risk_flags")
      .upsert(
        {
          store_id: storeId,
          is_suspended: body.isSuspended === true,
          reason: body.reason ?? null,
          updated_by: userRow.id,
          updated_at: nowIso,
        },
        { onConflict: "store_id" }
      )
      .select("*")
      .single();

    if (upsertError) {
      throw new Error(`Failed to update store risk flags: ${upsertError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: body.isSuspended === true ? "store_suspended" : "store_reinstated",
      city_slug: citySlug,
      store_id: storeId,
      actor_user_id: userRow.id,
      reason: body.reason ?? "Store risk status changed",
      payload: {
        appInstanceId,
        isSuspended: body.isSuspended === true,
      },
    });

    return NextResponse.json({ storeRisk: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error updating store risk";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
