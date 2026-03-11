import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, userHasAnyRole } from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { userRow, serviceRole } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const includeMappings = url.searchParams.get("includeMappings") === "true";

    const [biasResult, appInstanceId] = await Promise.all([
      serviceRole
        .from("bia_registry")
        .select("*")
        .eq("city_slug", citySlug)
        .order("name", { ascending: true }),
      resolveActiveAppInstanceId({ supabase: serviceRole, citySlug }),
    ]);

    if (biasResult.error) {
      throw new Error(`Failed to load BIAs: ${biasResult.error.message}`);
    }

    const [activeAffiliation, isAdminOrOperator] = await Promise.all([
      serviceRole
        .from("user_bia_affiliations")
        .select("id,bia_id,source,effective_from")
        .eq("user_id", userRow.id)
        .eq("app_instance_id", appInstanceId)
        .is("effective_to", null)
        .limit(1)
        .maybeSingle(),
      userHasAnyRole({
        supabase: serviceRole,
        userId: Number(userRow.id),
        appInstanceId,
        roles: ["admin", "operator"],
      }),
    ]);

    if (activeAffiliation.error) {
      throw new Error(`Failed to load active affiliation: ${activeAffiliation.error.message}`);
    }

    let mappings: unknown[] = [];
    let controls: unknown[] = [];

    if (includeMappings && isAdminOrOperator) {
      const [mappingResult, controlsResult] = await Promise.all([
        serviceRole
          .from("bia_pool_mappings")
          .select("*")
          .in("bia_id", (biasResult.data ?? []).map((bia) => bia.id))
          .order("updated_at", { ascending: false }),
        serviceRole
          .from("bia_pool_controls")
          .select("*"),
      ]);

      if (mappingResult.error) {
        throw new Error(`Failed to load BIA pool mappings: ${mappingResult.error.message}`);
      }

      if (controlsResult.error) {
        throw new Error(`Failed to load BIA controls: ${controlsResult.error.message}`);
      }

      mappings = mappingResult.data ?? [];
      controls = controlsResult.data ?? [];
    }

    return NextResponse.json({
      citySlug,
      appInstanceId,
      activeAffiliation: activeAffiliation.data
        ? {
            id: activeAffiliation.data.id,
            biaId: activeAffiliation.data.bia_id,
            source: activeAffiliation.data.source,
            effectiveFrom: activeAffiliation.data.effective_from,
          }
        : null,
      bias: biasResult.data ?? [],
      mappings,
      controls,
      canAdminister: isAdminOrOperator,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading BIAs";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
