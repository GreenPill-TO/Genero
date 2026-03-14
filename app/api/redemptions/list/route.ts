import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, userHasAnyRole } from "@shared/lib/bia/server";

const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "settled", "failed"]);

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const statusFilterRaw = url.searchParams.get("status");
    const statusFilter = statusFilterRaw ? statusFilterRaw.trim().toLowerCase() : null;
    const storeIdFilter = Number(url.searchParams.get("storeId") ?? 0);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));

    if (statusFilter && !ALLOWED_STATUSES.has(statusFilter)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const isAdminOrOperator = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    const { data: storeRows, error: storeRowsError } = await serviceRole
      .from("store_employees")
      .select("store_id")
      .eq("user_id", userRow.id)
      .eq("app_instance_id", appInstanceId);

    if (storeRowsError) {
      throw new Error(`Failed to resolve store access scope: ${storeRowsError.message}`);
    }

    const scopedStoreIds = new Set<number>(
      (storeRows ?? [])
        .map((row: any) => Number(row.store_id))
        .filter((value: number) => Number.isFinite(value) && value > 0)
    );

    if (!isAdminOrOperator && Number.isFinite(storeIdFilter) && storeIdFilter > 0 && !scopedStoreIds.has(storeIdFilter)) {
      return NextResponse.json({ error: "Forbidden: store access required." }, { status: 403 });
    }

    let query = serviceRole
      .from("pool_redemption_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (Number.isFinite(storeIdFilter) && storeIdFilter > 0) {
      query = query.eq("store_id", storeIdFilter);
    }

    if (!isAdminOrOperator) {
      const storeScope = Array.from(scopedStoreIds);
      if (storeScope.length > 0) {
        query = query.or(`requester_user_id.eq.${userRow.id},store_id.in.(${storeScope.join(",")})`);
      } else {
        query = query.eq("requester_user_id", userRow.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load redemption requests: ${error.message}`);
    }

    const biaIds = Array.from(
      new Set((data ?? []).map((row: any) => String(row.bia_id ?? "")).filter(Boolean))
    );
    const storeIds = Array.from(
      new Set(
        (data ?? [])
          .map((row: any) => Number(row.store_id))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );
    const requestIds = Array.from(
      new Set((data ?? []).map((row: any) => String(row.id ?? "")).filter(Boolean))
    );

    const [biaResult, storeResult, settlementResult] = await Promise.all([
      biaIds.length > 0
        ? serviceRole
            .from("bia_registry")
            .select("id,city_slug,code,name")
            .eq("city_slug", citySlug)
            .in("id", biaIds)
        : Promise.resolve({ data: [], error: null }),
      storeIds.length > 0
        ? serviceRole
            .from("store_profiles")
            .select("store_id,display_name,wallet_address,status")
            .in("store_id", storeIds)
        : Promise.resolve({ data: [], error: null }),
      requestIds.length > 0
        ? serviceRole
            .from("pool_redemption_settlements")
            .select("*")
            .in("redemption_request_id", requestIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (biaResult.error) {
      throw new Error(`Failed to resolve BIA labels for redemption requests: ${biaResult.error.message}`);
    }
    if (storeResult.error) {
      throw new Error(`Failed to resolve store profile labels for redemption requests: ${storeResult.error.message}`);
    }
    if (settlementResult.error) {
      throw new Error(`Failed to resolve settlements for redemption requests: ${settlementResult.error.message}`);
    }

    const biaById = new Map((biaResult.data ?? []).map((row: any) => [String(row.id), row]));
    const storeById = new Map((storeResult.data ?? []).map((row: any) => [Number(row.store_id), row]));
    const settlementsByRequestId = new Map<string, any[]>();
    for (const row of settlementResult.data ?? []) {
      const requestId = String((row as any).redemption_request_id ?? "");
      const list = settlementsByRequestId.get(requestId) ?? [];
      list.push(row);
      settlementsByRequestId.set(requestId, list);
    }

    const enrichedRequests = (data ?? [])
      .map((row: any) => ({
        ...row,
        bia: biaById.get(String(row.bia_id)) ?? null,
        storeProfile: storeById.get(Number(row.store_id)) ?? null,
        settlements: settlementsByRequestId.get(String(row.id)) ?? [],
      }))
      .filter((row: any) => row.bia !== null);

    const summary = {
      total: enrichedRequests.length,
      pending: enrichedRequests.filter((row: any) => row.status === "pending").length,
      approved: enrichedRequests.filter((row: any) => row.status === "approved").length,
      settled: enrichedRequests.filter((row: any) => row.status === "settled").length,
      failed: enrichedRequests.filter((row: any) => row.status === "failed").length,
      rejected: enrichedRequests.filter((row: any) => row.status === "rejected").length,
    };

    return NextResponse.json({
      citySlug,
      appInstanceId,
      isAdminOrOperator,
      summary,
      requests: enrichedRequests,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading redemption requests";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
