import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertStoreAdminAccess, resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const storeId = Number(params.id);

    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "Invalid store id." }, { status: 400 });
    }

    const body = (await req.json()) as {
      biaId?: string;
      source?: "merchant_selected" | "suggested" | "admin_assigned" | "migrated";
      citySlug?: string;
    };

    if (!body.biaId) {
      return NextResponse.json({ error: "biaId is required." }, { status: 400 });
    }

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const { data: storeRow, error: storeError } = await serviceRole
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Failed to validate store/app scope: ${storeError.message}`);
    }

    if (!storeRow) {
      return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
    }

    await assertStoreAdminAccess({
      supabase: serviceRole,
      userId: Number(userRow.id),
      storeId,
      appInstanceId,
    });

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id")
      .eq("id", body.biaId)
      .eq("city_slug", citySlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate BIA: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json({ error: "BIA not found or inactive for this city." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { error: closeError } = await serviceRole
      .from("store_bia_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("store_id", storeId)
      .is("effective_to", null);

    if (closeError) {
      throw new Error(`Failed to close previous store affiliation: ${closeError.message}`);
    }

    const { data: inserted, error: insertError } = await serviceRole
      .from("store_bia_affiliations")
      .insert({
        store_id: storeId,
        bia_id: biaRow.id,
        source: body.source ?? "merchant_selected",
        effective_from: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to assign store to BIA: ${insertError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "store_bia_assigned",
      city_slug: citySlug,
      bia_id: biaRow.id,
      store_id: storeId,
      actor_user_id: userRow.id,
      reason: "Store BIA updated",
      payload: {
        appInstanceId,
        source: body.source ?? "merchant_selected",
      },
    });

    return NextResponse.json({ affiliation: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error assigning store BIA";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
