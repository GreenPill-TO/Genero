import { assertAdminOrOperator, assertStoreAccess } from "./rbac.ts";
import { toNumber } from "./validation.ts";

type RedemptionContext = {
  supabase: any;
  userId: number;
  appContext: {
    citySlug: string;
    appInstanceId: number;
  };
};

async function resolveActiveBiaPoolMapping(options: {
  supabase: any;
  biaId: string;
  chainId: number;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("*")
    .eq("bia_id", options.biaId)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve BIA pool mapping: ${error.message}`);
  }

  return data
    ? {
        poolAddress: String(data.pool_address),
        mappingStatus: String(data.mapping_status ?? "inactive"),
        effectiveTo: data.effective_to ?? null,
      }
    : null;
}

function assertActiveMapping(mapping: { poolAddress: string; mappingStatus: string; effectiveTo?: string | null } | null): asserts mapping is {
  poolAddress: string;
  mappingStatus: string;
  effectiveTo?: string | null;
} {
  if (!mapping) {
    throw new Error("No active BIA pool mapping found.");
  }
  if (mapping.mappingStatus !== "active") {
    throw new Error("BIA pool mapping is not active.");
  }
  if (mapping.effectiveTo) {
    throw new Error("BIA pool mapping is no longer effective.");
  }
}

async function assertBiaPoolNotFrozen(options: { supabase: any; biaId: string }) {
  const { data, error } = await options.supabase
    .from("bia_pool_controls")
    .select("is_frozen")
    .eq("bia_id", options.biaId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate BIA pool controls: ${error.message}`);
  }
  if (data?.is_frozen === true) {
    throw new Error("This BIA pool is currently frozen.");
  }
}

async function assertStoreNotSuspended(options: { supabase: any; storeId: number }) {
  const { data, error } = await options.supabase
    .from("store_risk_flags")
    .select("is_suspended")
    .eq("store_id", options.storeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate store risk status: ${error.message}`);
  }
  if (data?.is_suspended === true) {
    throw new Error("This store is currently suspended from redemption operations.");
  }
}

async function assertPoolRedemptionLimits(options: {
  supabase: any;
  biaId: string;
  tokenAmount: number;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_controls")
    .select("max_tx_amount,max_daily_redemption")
    .eq("bia_id", options.biaId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate pool redemption controls: ${error.message}`);
  }
  if (!data) {
    return;
  }
  if (typeof data.max_tx_amount === "number" && data.max_tx_amount > 0 && options.tokenAmount > data.max_tx_amount) {
    throw new Error(`Requested redemption exceeds BIA max_tx_amount (${data.max_tx_amount}).`);
  }
  if (typeof data.max_daily_redemption === "number" && data.max_daily_redemption > 0) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: pendingRows, error: pendingError } = await options.supabase
      .from("pool_redemption_requests")
      .select("token_amount")
      .eq("bia_id", options.biaId)
      .gte("created_at", startOfDay.toISOString())
      .in("status", ["pending", "approved", "settled"]);

    if (pendingError) {
      throw new Error(`Failed to evaluate max_daily_redemption: ${pendingError.message}`);
    }

    const total = (pendingRows ?? []).reduce((sum: number, row: any) => {
      const value = typeof row.token_amount === "number" ? row.token_amount : Number(row.token_amount ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    if (total + options.tokenAmount > data.max_daily_redemption) {
      throw new Error(`Requested redemption exceeds BIA max_daily_redemption (${data.max_daily_redemption}).`);
    }
  }
}

export async function createRedemptionRequest(
  options: RedemptionContext & { payload: Record<string, unknown> }
) {
  const body = options.payload;
  const storeId = Number(body.storeId ?? 0);
  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new Error("storeId must be a positive number.");
  }

  await assertStoreAccess({
    supabase: options.supabase,
    userId: options.userId,
    storeId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: scopedStore, error: scopedStoreError } = await options.supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (scopedStoreError) throw new Error(`Failed to validate store scope: ${scopedStoreError.message}`);
  if (!scopedStore) throw new Error("Store not found in this app instance.");

  const chainId = Math.max(1, Math.trunc(toNumber(body.chainId, 42220)));
  const tokenAmount = toNumber(body.tokenAmount, 0);
  const settlementAmount = body.settlementAmount == null ? null : toNumber(body.settlementAmount, Number.NaN);
  if (!(tokenAmount > 0)) throw new Error("tokenAmount must be a positive number.");
  if (settlementAmount !== null && Number.isNaN(settlementAmount)) {
    throw new Error("settlementAmount must be numeric when provided.");
  }

  const settlementAsset = String(body.settlementAsset ?? "CAD").trim().toUpperCase();
  if (!["CAD", "TTC", "USDC"].includes(settlementAsset)) {
    throw new Error("settlementAsset must be one of CAD, TTC, USDC.");
  }

  const { data: storeBia, error: storeBiaError } = await options.supabase
    .from("store_bia_affiliations")
    .select("bia_id")
    .eq("store_id", storeId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (storeBiaError) throw new Error(`Failed to resolve store BIA affiliation: ${storeBiaError.message}`);
  if (!storeBia?.bia_id) throw new Error("Store does not have an active BIA affiliation.");

  const { data: biaRow, error: biaError } = await options.supabase
    .from("bia_registry")
    .select("id,city_slug,status")
    .eq("id", storeBia.bia_id)
    .eq("city_slug", options.appContext.citySlug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (biaError) throw new Error(`Failed to validate store BIA: ${biaError.message}`);
  if (!biaRow) throw new Error("Store BIA is inactive or not mapped to this city.");

  const mapping = await resolveActiveBiaPoolMapping({
    supabase: options.supabase,
    biaId: storeBia.bia_id,
    chainId,
  });
  assertActiveMapping(mapping);
  await Promise.all([
    assertBiaPoolNotFrozen({ supabase: options.supabase, biaId: storeBia.bia_id }),
    assertStoreNotSuspended({ supabase: options.supabase, storeId }),
    assertPoolRedemptionLimits({ supabase: options.supabase, biaId: storeBia.bia_id, tokenAmount }),
  ]);

  const nowIso = new Date().toISOString();
  const { data: requestRow, error: requestError } = await options.supabase
    .from("pool_redemption_requests")
    .insert({
      store_id: storeId,
      requester_user_id: options.userId,
      bia_id: storeBia.bia_id,
      chain_id: chainId,
      pool_address: mapping.poolAddress,
      settlement_asset: settlementAsset,
      token_amount: tokenAmount,
      settlement_amount: settlementAmount,
      status: "pending",
      metadata: {
        ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
        appInstanceId: options.appContext.appInstanceId,
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

  await options.supabase.from("governance_actions_log").insert({
    action_type: "redemption_requested",
    city_slug: options.appContext.citySlug,
    bia_id: storeBia.bia_id,
    store_id: storeId,
    actor_user_id: options.userId,
    reason: "Merchant redemption request created",
    payload: {
      appInstanceId: options.appContext.appInstanceId,
      chainId,
      poolAddress: mapping.poolAddress,
      tokenAmount,
      settlementAsset,
      settlementAmount,
    },
  });

  return {
    request: requestRow,
    routing: {
      chainId,
      biaId: storeBia.bia_id,
      poolAddress: mapping.poolAddress,
    },
  };
}

export async function listRedemptionRequests(
  options: RedemptionContext & { statusFilter: string | null; storeIdFilter: number; limit: number }
) {
  if (options.statusFilter && !["pending", "approved", "rejected", "settled", "failed"].includes(options.statusFilter)) {
    throw new Error("Invalid status filter.");
  }

  const isAdminOrOperator = await userIsAdminOrOperator(options);
  const { data: storeRows, error: storeRowsError } = await options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (storeRowsError) {
    throw new Error(`Failed to resolve store access scope: ${storeRowsError.message}`);
  }

  const scopedStoreIds = new Set<number>(
    (storeRows ?? []).map((row: any) => Number(row.store_id)).filter((value: number) => Number.isFinite(value) && value > 0)
  );

  if (!isAdminOrOperator && Number.isFinite(options.storeIdFilter) && options.storeIdFilter > 0 && !scopedStoreIds.has(options.storeIdFilter)) {
    throw new Error("Forbidden: store access required.");
  }

  let query = options.supabase
    .from("pool_redemption_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (options.statusFilter) {
    query = query.eq("status", options.statusFilter);
  }
  if (Number.isFinite(options.storeIdFilter) && options.storeIdFilter > 0) {
    query = query.eq("store_id", options.storeIdFilter);
  }
  if (!isAdminOrOperator) {
    const storeScope = Array.from(scopedStoreIds);
    if (storeScope.length > 0) {
      query = query.or(`requester_user_id.eq.${options.userId},store_id.in.(${storeScope.join(",")})`);
    } else {
      query = query.eq("requester_user_id", options.userId);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load redemption requests: ${error.message}`);

  const biaIds = Array.from(new Set((data ?? []).map((row: any) => String(row.bia_id ?? "")).filter(Boolean)));
  const storeIds = Array.from(
    new Set((data ?? []).map((row: any) => Number(row.store_id)).filter((value: number) => Number.isFinite(value) && value > 0))
  );
  const requestIds = Array.from(new Set((data ?? []).map((row: any) => String(row.id ?? "")).filter(Boolean)));

  const [biaResult, storeResult, settlementResult] = await Promise.all([
    biaIds.length > 0
      ? options.supabase.from("bia_registry").select("id,city_slug,code,name").eq("city_slug", options.appContext.citySlug).in("id", biaIds)
      : Promise.resolve({ data: [], error: null }),
    storeIds.length > 0
      ? options.supabase.from("store_profiles").select("store_id,display_name,wallet_address,status").in("store_id", storeIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length > 0
      ? options.supabase.from("pool_redemption_settlements").select("*").in("redemption_request_id", requestIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (biaResult.error) throw new Error(`Failed to resolve BIA labels for redemption requests: ${biaResult.error.message}`);
  if (storeResult.error) throw new Error(`Failed to resolve store profile labels for redemption requests: ${storeResult.error.message}`);
  if (settlementResult.error) throw new Error(`Failed to resolve settlements for redemption requests: ${settlementResult.error.message}`);

  const biaById = new Map((biaResult.data ?? []).map((row: any) => [String(row.id), row]));
  const storeById = new Map((storeResult.data ?? []).map((row: any) => [Number(row.store_id), row]));
  const settlementsByRequestId = new Map<string, any[]>();
  for (const row of settlementResult.data ?? []) {
    const requestId = String((row as any).redemption_request_id ?? "");
    const list = settlementsByRequestId.get(requestId) ?? [];
    list.push(row);
    settlementsByRequestId.set(requestId, list);
  }

  const requests = (data ?? [])
    .map((row: any) => ({
      ...row,
      bia: biaById.get(String(row.bia_id)) ?? null,
      storeProfile: storeById.get(Number(row.store_id)) ?? null,
      settlements: settlementsByRequestId.get(String(row.id)) ?? [],
    }))
    .filter((row: any) => row.bia !== null);

  const summary = {
    total: requests.length,
    pending: requests.filter((row: any) => row.status === "pending").length,
    approved: requests.filter((row: any) => row.status === "approved").length,
    settled: requests.filter((row: any) => row.status === "settled").length,
    failed: requests.filter((row: any) => row.status === "failed").length,
    rejected: requests.filter((row: any) => row.status === "rejected").length,
  };

  return {
    citySlug: options.appContext.citySlug,
    appInstanceId: options.appContext.appInstanceId,
    isAdminOrOperator,
    summary,
    requests,
  };
}

async function userIsAdminOrOperator(options: RedemptionContext): Promise<boolean> {
  const { data, error } = await options.supabase
    .from("roles")
    .select("role")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .in("role", ["admin", "operator"]);

  if (error) throw new Error(`Failed to resolve user roles: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

export async function approveRedemption(
  options: RedemptionContext & { requestId: string; payload: Record<string, unknown> }
) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: current, error: currentError } = await options.supabase
    .from("pool_redemption_requests")
    .select("id,status,bia_id,store_id")
    .eq("id", options.requestId)
    .limit(1)
    .maybeSingle();

  if (currentError) throw new Error(`Failed to load redemption request: ${currentError.message}`);
  if (!current) throw new Error("Redemption request not found.");
  if (["settled", "failed", "rejected"].includes(String(current.status))) {
    throw new Error(`Cannot approve request in '${current.status}' state.`);
  }

  const approve = options.payload.approve !== false;
  const nextStatus = approve ? "approved" : "rejected";
  const nowIso = new Date().toISOString();

  const { data: updated, error: updateError } = await options.supabase
    .from("pool_redemption_requests")
    .update({
      status: nextStatus,
      approved_by: approve ? options.userId : null,
      approved_at: approve ? nowIso : null,
      rejection_reason: approve ? null : options.payload.rejectionReason ?? "Rejected by operator",
      updated_at: nowIso,
    })
    .eq("id", options.requestId)
    .select("*")
    .single();

  if (updateError) throw new Error(`Failed to update redemption request status: ${updateError.message}`);

  await options.supabase.from("governance_actions_log").insert({
    action_type: approve ? "redemption_approved" : "redemption_rejected",
    city_slug: options.appContext.citySlug,
    bia_id: current.bia_id,
    store_id: current.store_id,
    actor_user_id: options.userId,
    reason:
      typeof options.payload.reason === "string"
        ? options.payload.reason
        : approve
          ? "Redemption request approved"
          : "Redemption request rejected",
    payload: {
      appInstanceId: options.appContext.appInstanceId,
      requestId: options.requestId,
      status: nextStatus,
      rejectionReason: approve ? null : options.payload.rejectionReason ?? null,
    },
  });

  return { request: updated };
}

export async function settleRedemption(
  options: RedemptionContext & { requestId: string; payload: Record<string, unknown> }
) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: current, error: currentError } = await options.supabase
    .from("pool_redemption_requests")
    .select("*")
    .eq("id", options.requestId)
    .limit(1)
    .maybeSingle();

  if (currentError) throw new Error(`Failed to load redemption request: ${currentError.message}`);
  if (!current) throw new Error("Redemption request not found.");
  if (!options.payload.failed && current.status !== "approved") {
    throw new Error(`Only approved requests can be settled (current status: ${current.status}).`);
  }
  if (options.payload.failed && ["settled", "failed"].includes(current.status)) {
    throw new Error(`Request already finalized with status '${current.status}'.`);
  }

  const settlementAmount =
    options.payload.settlementAmount == null
      ? toNumber(current.settlement_amount, Number.NaN)
      : toNumber(options.payload.settlementAmount, Number.NaN);

  if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
    throw new Error("settlementAmount must be a positive number for settlement.");
  }

  const nowIso = new Date().toISOString();
  const settlementAsset = String(options.payload.settlementAsset ?? current.settlement_asset ?? "CAD")
    .trim()
    .toUpperCase();
  const nextStatus = options.payload.failed === true ? "failed" : "settled";

  const { data: updatedRequest, error: updateError } = await options.supabase
    .from("pool_redemption_requests")
    .update({
      status: nextStatus,
      settlement_amount: settlementAmount,
      settlement_asset: settlementAsset,
      settled_by: options.userId,
      settled_at: nowIso,
      tx_hash: options.payload.txHash ?? null,
      updated_at: nowIso,
    })
    .eq("id", options.requestId)
    .select("*")
    .single();

  if (updateError) throw new Error(`Failed to update redemption request for settlement: ${updateError.message}`);

  const { data: settlementRow, error: settlementError } = await options.supabase
    .from("pool_redemption_settlements")
    .insert({
      redemption_request_id: options.requestId,
      settled_by: options.userId,
      chain_id: current.chain_id,
      tx_hash: options.payload.txHash ?? null,
      settlement_amount: settlementAmount,
      settlement_asset: settlementAsset,
      status: options.payload.failed === true ? "failed" : "confirmed",
      notes: options.payload.notes ?? null,
      metadata: {
        appInstanceId: options.appContext.appInstanceId,
        citySlug: options.appContext.citySlug,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (settlementError) throw new Error(`Failed to create settlement record: ${settlementError.message}`);

  await options.supabase.from("governance_actions_log").insert({
    action_type: options.payload.failed === true ? "redemption_settlement_failed" : "redemption_settled",
    city_slug: options.appContext.citySlug,
    bia_id: current.bia_id,
    store_id: current.store_id,
    actor_user_id: options.userId,
    reason:
      typeof options.payload.reason === "string"
        ? options.payload.reason
        : options.payload.failed === true
          ? "Redemption settlement execution failed"
          : "Redemption settlement executed",
    payload: {
      appInstanceId: options.appContext.appInstanceId,
      requestId: options.requestId,
      txHash: options.payload.txHash ?? null,
      settlementAmount,
      settlementAsset,
      status: nextStatus,
    },
  });

  return {
    request: updatedRequest,
    settlement: settlementRow,
  };
}
