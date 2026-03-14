import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { assertAdminOrOperator, userHasAnyRole } from "../_shared/rbac.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { haversineKm, toNumber } from "../_shared/validation.ts";
import { getAddress, isAddress } from "npm:viem@2.23.3";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

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

async function readBody(req: Request) {
  if (req.method === "GET" || req.method === "OPTIONS") {
    return null;
  }

  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await readBody(req);
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, body),
    });
    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/bia-service/, "").replace(/^\/bia-service/, "") || "/";
    const url = new URL(req.url);

    if (req.method === "GET" && pathname === "/list") {
      const includeMappings = url.searchParams.get("includeMappings") === "true";
      const [biasResult, activeAffiliation, secondaryAffiliations, canAdminister] = await Promise.all([
        auth.serviceRole
          .from("bia_registry")
          .select("*")
          .eq("city_slug", appContext.citySlug)
          .order("name", { ascending: true }),
        auth.serviceRole
          .from("user_bia_affiliations")
          .select("id,bia_id,source,effective_from")
          .eq("user_id", auth.userRow.id)
          .eq("app_instance_id", appContext.appInstanceId)
          .is("effective_to", null)
          .limit(1)
          .maybeSingle(),
        auth.serviceRole
          .from("user_bia_secondary_affiliations")
          .select("id,bia_id,source,effective_from")
          .eq("user_id", auth.userRow.id)
          .eq("app_instance_id", appContext.appInstanceId)
          .is("effective_to", null)
          .order("effective_from", { ascending: true }),
        userHasAnyRole({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appInstanceId: appContext.appInstanceId,
          roles: ["admin", "operator"],
        }),
      ]);

      if (biasResult.error) throw new Error(`Failed to load BIAs: ${biasResult.error.message}`);
      if (activeAffiliation.error) throw new Error(`Failed to load active affiliation: ${activeAffiliation.error.message}`);
      if (secondaryAffiliations.error) {
        throw new Error(`Failed to load secondary affiliations: ${secondaryAffiliations.error.message}`);
      }

      let mappings: unknown[] = [];
      let controls: unknown[] = [];
      if (includeMappings && canAdminister) {
        const [mappingResult, controlsResult] = await Promise.all([
          auth.serviceRole
            .from("bia_pool_mappings")
            .select("*")
            .in("bia_id", (biasResult.data ?? []).map((bia: any) => bia.id))
            .order("updated_at", { ascending: false }),
          auth.serviceRole.from("bia_pool_controls").select("*"),
        ]);
        if (mappingResult.error) throw new Error(`Failed to load BIA pool mappings: ${mappingResult.error.message}`);
        if (controlsResult.error) throw new Error(`Failed to load BIA controls: ${controlsResult.error.message}`);
        mappings = mappingResult.data ?? [];
        controls = controlsResult.data ?? [];
      }

      return jsonResponse({
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        activeAffiliation: activeAffiliation.data
          ? {
              id: activeAffiliation.data.id,
              biaId: activeAffiliation.data.bia_id,
              source: activeAffiliation.data.source,
              effectiveFrom: activeAffiliation.data.effective_from,
            }
          : null,
        secondaryAffiliations: (secondaryAffiliations.data ?? []).map((row: any) => ({
          id: row.id,
          biaId: row.bia_id,
          source: row.source,
          effectiveFrom: row.effective_from,
        })),
        bias: biasResult.data ?? [],
        mappings,
        controls,
        canAdminister,
      });
    }

    if (req.method === "GET" && pathname === "/mappings") {
      const chainId = Math.max(1, Math.trunc(toNumber(url.searchParams.get("chainId"), 42220)));
      const includeHealth = url.searchParams.get("includeHealth") !== "false";
      const canAdminister = await userHasAnyRole({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        roles: ["admin", "operator"],
      });

      const { data: mappings, error: mappingError } = await auth.serviceRole
        .from("bia_pool_mappings")
        .select("*, bia_registry!inner(city_slug,code,name)")
        .eq("bia_registry.city_slug", appContext.citySlug)
        .eq("chain_id", chainId)
        .order("updated_at", { ascending: false });

      if (mappingError) throw new Error(`Failed to load BIA mappings: ${mappingError.message}`);

      let health = null;
      if (includeHealth) {
        const [activeMappingsResult, activePoolsResult] = await Promise.all([
          auth.serviceRole
            .from("bia_pool_mappings")
            .select("pool_address,validation_status,bia_id,bia_registry!inner(city_slug,code,name)")
            .eq("bia_registry.city_slug", appContext.citySlug)
            .eq("chain_id", chainId)
            .eq("mapping_status", "active")
            .is("effective_to", null),
          auth.serviceRole
            .schema("indexer")
            .from("pool_links")
            .select("pool_address")
            .eq("city_slug", appContext.citySlug)
            .eq("chain_id", chainId)
            .eq("is_active", true),
        ]);

        if (activeMappingsResult.error) throw new Error(`Failed to load active mappings: ${activeMappingsResult.error.message}`);
        if (activePoolsResult.error) throw new Error(`Failed to load discovered pools: ${activePoolsResult.error.message}`);

        const mappedPoolSet = new Set((activeMappingsResult.data ?? []).map((row: any) => String(row.pool_address).toLowerCase()));
        const discoveredPoolSet = new Set((activePoolsResult.data ?? []).map((row: any) => String(row.pool_address).toLowerCase()));
        let staleMappings = 0;
        for (const row of activeMappingsResult.data ?? []) {
          const status = String((row as any).validation_status ?? "unknown").toLowerCase();
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

        health = {
          mappedPools: mappedPoolSet.size,
          discoveredPools: discoveredPoolSet.size,
          unmappedPools,
          staleMappings,
        };
      }

      return jsonResponse({
        citySlug: appContext.citySlug,
        chainId,
        canAdminister,
        mappings: mappings ?? [],
        health,
      });
    }

    if (req.method === "POST" && pathname === "/mappings") {
      await assertAdminOrOperator({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
      });

      const chainId = Math.max(1, Math.trunc(toNumber(body?.chainId, 42220)));
      const mappingStatus: MappingStatus = (body?.mappingStatus as MappingStatus) ?? "active";
      const biaId = typeof body?.biaId === "string" ? body.biaId : "";
      const poolAddress = normalizeAddress(body?.poolAddress);

      if (!biaId) return jsonResponse({ error: "biaId is required." }, { status: 400 });
      if (!poolAddress) return jsonResponse({ error: "poolAddress must be a valid 0x address." }, { status: 400 });

      const { data: biaRow, error: biaError } = await auth.serviceRole
        .from("bia_registry")
        .select("id,city_slug")
        .eq("id", biaId)
        .eq("city_slug", appContext.citySlug)
        .limit(1)
        .maybeSingle();

      if (biaError) throw new Error(`Failed to validate BIA: ${biaError.message}`);
      if (!biaRow) return jsonResponse({ error: "BIA not found for selected city." }, { status: 400 });

      const nowIso = new Date().toISOString();
      if (mappingStatus === "active") {
        await auth.serviceRole
          .from("bia_pool_mappings")
          .update({ mapping_status: "inactive", effective_to: nowIso, updated_at: nowIso })
          .eq("bia_id", biaId)
          .eq("chain_id", chainId)
          .eq("mapping_status", "active")
          .is("effective_to", null);

        await auth.serviceRole
          .from("bia_pool_mappings")
          .update({ mapping_status: "inactive", effective_to: nowIso, updated_at: nowIso })
          .eq("chain_id", chainId)
          .eq("pool_address", poolAddress)
          .eq("mapping_status", "active")
          .is("effective_to", null);
      }

      const { data: inserted, error: insertError } = await auth.serviceRole
        .from("bia_pool_mappings")
        .insert({
          bia_id: biaId,
          chain_id: chainId,
          pool_address: poolAddress,
          token_registry: normalizeAddress(body?.tokenRegistry),
          token_limiter: normalizeAddress(body?.tokenLimiter),
          quoter: normalizeAddress(body?.quoter),
          fee_address: normalizeAddress(body?.feeAddress),
          mapping_status: mappingStatus,
          validation_status: "unknown",
          validation_notes: body?.validationNotes ?? null,
          effective_from: body?.effectiveFrom ?? nowIso,
          effective_to: mappingStatus === "active" ? null : nowIso,
          created_by: auth.userRow.id,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (insertError) throw new Error(`Failed to create BIA mapping: ${insertError.message}`);
      return jsonResponse({
        citySlug: appContext.citySlug,
        chainId,
        canAdminister: true,
        mappings: [inserted],
        health: null,
      });
    }

    if (req.method === "GET" && pathname === "/controls") {
      const canAdminister = await userHasAnyRole({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        roles: ["admin", "operator"],
      });

      const { data, error } = await auth.serviceRole
        .from("bia_pool_controls")
        .select("*, bia_registry!inner(city_slug,code,name)")
        .eq("bia_registry.city_slug", appContext.citySlug)
        .order("updated_at", { ascending: false });

      if (error) throw new Error(`Failed to load BIA controls: ${error.message}`);
      return jsonResponse({
        citySlug: appContext.citySlug,
        canAdminister,
        controls: data ?? [],
      });
    }

    if (req.method === "POST" && pathname === "/controls") {
      await assertAdminOrOperator({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
      });

      const biaId = typeof body?.biaId === "string" ? body.biaId : "";
      if (!biaId) return jsonResponse({ error: "biaId is required." }, { status: 400 });

      const { data: biaRow, error: biaError } = await auth.serviceRole
        .from("bia_registry")
        .select("id")
        .eq("id", biaId)
        .eq("city_slug", appContext.citySlug)
        .limit(1)
        .maybeSingle();

      if (biaError) throw new Error(`Failed to validate BIA control target: ${biaError.message}`);
      if (!biaRow) return jsonResponse({ error: "BIA not found for selected city." }, { status: 400 });

      const maxDaily = body?.maxDailyRedemption == null ? null : toNumber(body.maxDailyRedemption, Number.NaN);
      const maxTx = body?.maxTxAmount == null ? null : toNumber(body.maxTxAmount, Number.NaN);
      if (Number.isNaN(maxDaily) || Number.isNaN(maxTx)) {
        return jsonResponse(
          { error: "maxDailyRedemption/maxTxAmount must be numeric values when provided." },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const { data: updated, error: upsertError } = await auth.serviceRole
        .from("bia_pool_controls")
        .upsert(
          {
            bia_id: biaId,
            max_daily_redemption: maxDaily,
            max_tx_amount: maxTx,
            queue_only_mode: body?.queueOnlyMode ?? false,
            is_frozen: body?.isFrozen ?? false,
            updated_by: auth.userRow.id,
            updated_at: nowIso,
          },
          { onConflict: "bia_id" }
        )
        .select("*")
        .single();

      if (upsertError) throw new Error(`Failed to update BIA controls: ${upsertError.message}`);

      await auth.serviceRole.from("governance_actions_log").insert({
        action_type: "bia_controls_updated",
        city_slug: appContext.citySlug,
        bia_id: biaId,
        actor_user_id: auth.userRow.id,
        reason: typeof body?.reason === "string" ? body.reason : "BIA risk controls updated",
        payload: {
          appInstanceId: appContext.appInstanceId,
          maxDailyRedemption: maxDaily,
          maxTxAmount: maxTx,
          queueOnlyMode: body?.queueOnlyMode ?? false,
          isFrozen: body?.isFrozen ?? false,
        },
      });

      return jsonResponse({ controls: updated });
    }

    if (req.method === "POST" && pathname === "/create") {
      await assertAdminOrOperator({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
      });

      const code = String(body?.code ?? "").trim().toUpperCase();
      const name = String(body?.name ?? "").trim();
      const centerLat = toNumber(body?.centerLat, Number.NaN);
      const centerLng = toNumber(body?.centerLng, Number.NaN);

      if (!code || !name) return jsonResponse({ error: "code and name are required." }, { status: 400 });
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
        return jsonResponse({ error: "centerLat and centerLng are required numeric values." }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const { data: created, error: createError } = await auth.serviceRole
        .from("bia_registry")
        .insert({
          city_slug: appContext.citySlug,
          code,
          name,
          center_lat: centerLat,
          center_lng: centerLng,
          status: body?.status ?? "active",
          metadata: body?.metadata ?? {},
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (createError) throw new Error(`Failed to create BIA: ${createError.message}`);
      return jsonResponse({ bia: created }, { status: 201 });
    }

    if (req.method === "POST" && pathname === "/select") {
      const biaId = typeof body?.biaId === "string" ? body.biaId : "";
      if (!biaId) return jsonResponse({ error: "biaId is required." }, { status: 400 });

      const { data: biaRow, error: biaError } = await auth.serviceRole
        .from("bia_registry")
        .select("id,city_slug,status")
        .eq("id", biaId)
        .eq("city_slug", appContext.citySlug)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (biaError) throw new Error(`Failed to validate selected BIA: ${biaError.message}`);
      if (!biaRow) return jsonResponse({ error: "Selected BIA is not active for this city." }, { status: 400 });

      const requestedSecondaryBiaIds = Array.from(
        new Set(
          (Array.isArray(body?.secondaryBiaIds) ? body.secondaryBiaIds : [])
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value !== "" && value !== biaRow.id)
        )
      );

      let validatedSecondaryBiaIds: string[] = [];
      if (requestedSecondaryBiaIds.length > 0) {
        const { data: secondaryRows, error: secondaryError } = await auth.serviceRole
          .from("bia_registry")
          .select("id")
          .eq("city_slug", appContext.citySlug)
          .eq("status", "active")
          .in("id", requestedSecondaryBiaIds);

        if (secondaryError) throw new Error(`Failed to validate secondary BIAs: ${secondaryError.message}`);
        validatedSecondaryBiaIds = (secondaryRows ?? []).map((row: any) => String(row.id));
        if (validatedSecondaryBiaIds.length !== requestedSecondaryBiaIds.length) {
          return jsonResponse({ error: "One or more secondary BIAs are invalid or inactive for this city." }, { status: 400 });
        }
      }

      const nowIso = new Date().toISOString();
      await auth.serviceRole
        .from("user_bia_affiliations")
        .update({ effective_to: nowIso, updated_at: nowIso })
        .eq("user_id", auth.userRow.id)
        .eq("app_instance_id", appContext.appInstanceId)
        .is("effective_to", null);
      await auth.serviceRole
        .from("user_bia_secondary_affiliations")
        .update({ effective_to: nowIso, updated_at: nowIso })
        .eq("user_id", auth.userRow.id)
        .eq("app_instance_id", appContext.appInstanceId)
        .is("effective_to", null);

      const { data: inserted, error: insertError } = await auth.serviceRole
        .from("user_bia_affiliations")
        .insert({
          user_id: auth.userRow.id,
          app_instance_id: appContext.appInstanceId,
          bia_id: biaRow.id,
          source: body?.source ?? "user_selected",
          confidence: body?.confidence ?? null,
          effective_from: nowIso,
          effective_to: null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (insertError) throw new Error(`Failed to save BIA affiliation: ${insertError.message}`);

      if (validatedSecondaryBiaIds.length > 0) {
        const secondaryPayload = validatedSecondaryBiaIds.map((secondaryBiaId) => ({
          user_id: auth.userRow.id,
          app_instance_id: appContext.appInstanceId,
          bia_id: secondaryBiaId,
          source: body?.source ?? "user_selected",
          effective_from: nowIso,
          effective_to: null,
          created_at: nowIso,
          updated_at: nowIso,
        }));

        const { error: secondaryInsertError } = await auth.serviceRole
          .from("user_bia_secondary_affiliations")
          .insert(secondaryPayload);

        if (secondaryInsertError) {
          throw new Error(`Failed to save secondary BIA affiliations: ${secondaryInsertError.message}`);
        }
      }

      return jsonResponse({
        affiliation: inserted,
        secondaryAffiliationCount: validatedSecondaryBiaIds.length,
      });
    }

    if (req.method === "GET" && pathname === "/suggest") {
      const lat = toNumber(url.searchParams.get("lat"), Number.NaN);
      const lng = toNumber(url.searchParams.get("lng"), Number.NaN);
      const limit = Math.max(1, Math.min(20, Math.trunc(toNumber(url.searchParams.get("limit"), 5))));

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return jsonResponse({ error: "lat and lng query params are required numeric values." }, { status: 400 });
      }

      const { data, error } = await auth.serviceRole
        .from("bia_registry")
        .select("id,city_slug,code,name,center_lat,center_lng,status,metadata")
        .eq("city_slug", appContext.citySlug)
        .eq("status", "active");

      if (error) throw new Error(`Failed to load BIAs: ${error.message}`);

      const suggestions = (data ?? [])
        .map((bia: any) => ({
          ...bia,
          distanceKm: haversineKm(lat, lng, Number(bia.center_lat), Number(bia.center_lng)),
        }))
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
        .slice(0, limit);

      return jsonResponse({
        citySlug: appContext.citySlug,
        lat,
        lng,
        suggestions,
      });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected bia-service error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 400;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
