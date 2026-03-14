import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      biaId?: string;
      secondaryBiaIds?: string[];
      source?: "user_selected" | "suggested" | "admin_assigned" | "migrated";
      confidence?: string;
      citySlug?: string;
    };

    if (!body.biaId) {
      return NextResponse.json({ error: "biaId is required." }, { status: 400 });
    }

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id,city_slug,status")
      .eq("id", body.biaId)
      .eq("city_slug", citySlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate selected BIA: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json({ error: "Selected BIA is not active for this city." }, { status: 400 });
    }

    const requestedSecondaryBiaIds = Array.from(
      new Set(
        (Array.isArray(body.secondaryBiaIds) ? body.secondaryBiaIds : [])
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value !== "" && value !== biaRow.id)
      )
    );

    let validatedSecondaryBiaIds: string[] = [];
    if (requestedSecondaryBiaIds.length > 0) {
      const { data: secondaryRows, error: secondaryError } = await serviceRole
        .from("bia_registry")
        .select("id")
        .eq("city_slug", citySlug)
        .eq("status", "active")
        .in("id", requestedSecondaryBiaIds);

      if (secondaryError) {
        throw new Error(`Failed to validate secondary BIAs: ${secondaryError.message}`);
      }

      validatedSecondaryBiaIds = (secondaryRows ?? []).map((row) => String(row.id));
      if (validatedSecondaryBiaIds.length !== requestedSecondaryBiaIds.length) {
        return NextResponse.json(
          { error: "One or more secondary BIAs are invalid or inactive for this city." },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();

    const { error: closeError } = await serviceRole
      .from("user_bia_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("user_id", userRow.id)
      .eq("app_instance_id", appInstanceId)
      .is("effective_to", null);

    if (closeError) {
      throw new Error(`Failed to close previous affiliation: ${closeError.message}`);
    }

    const { error: closeSecondaryError } = await serviceRole
      .from("user_bia_secondary_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("user_id", userRow.id)
      .eq("app_instance_id", appInstanceId)
      .is("effective_to", null);

    if (closeSecondaryError) {
      throw new Error(`Failed to close previous secondary affiliations: ${closeSecondaryError.message}`);
    }

    const insertPayload = {
      user_id: userRow.id,
      app_instance_id: appInstanceId,
      bia_id: biaRow.id,
      source: body.source ?? "user_selected",
      confidence: body.confidence ?? null,
      effective_from: nowIso,
      effective_to: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error: insertError } = await serviceRole
      .from("user_bia_affiliations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to save BIA affiliation: ${insertError.message}`);
    }

    if (validatedSecondaryBiaIds.length > 0) {
      const secondaryPayload = validatedSecondaryBiaIds.map((biaId) => ({
        user_id: userRow.id,
        app_instance_id: appInstanceId,
        bia_id: biaId,
        source: body.source ?? "user_selected",
        effective_from: nowIso,
        effective_to: null,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: secondaryInsertError } = await serviceRole
        .from("user_bia_secondary_affiliations")
        .insert(secondaryPayload);

      if (secondaryInsertError) {
        throw new Error(`Failed to save secondary BIA affiliations: ${secondaryInsertError.message}`);
      }
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "user_bia_selected",
      city_slug: citySlug,
      bia_id: biaRow.id,
      actor_user_id: userRow.id,
      reason: "User selected primary BIA",
      payload: {
        appInstanceId,
        source: insertPayload.source,
        confidence: insertPayload.confidence,
        secondaryBiaIds: validatedSecondaryBiaIds,
      },
    });

    return NextResponse.json({
      affiliation: inserted,
      secondaryAffiliationCount: validatedSecondaryBiaIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error selecting BIA";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
