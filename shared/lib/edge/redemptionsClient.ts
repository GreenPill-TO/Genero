import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";

export async function createRedemptionRequest(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("redemptions", "/request", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function getRedemptionRequests(
  input?: {
    status?: string | null;
    storeId?: number | null;
    limit?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (input?.status) {
    params.set("status", input.status);
  }
  if (typeof input?.storeId === "number" && input.storeId > 0) {
    params.set("storeId", String(input.storeId));
  }
  if (typeof input?.limit === "number" && input.limit > 0) {
    params.set("limit", String(input.limit));
  }
  return invokeEdgeFunction<Record<string, unknown>>(
    "redemptions",
    `/list${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function approveRedemptionRequest(
  requestId: string,
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("redemptions", `/${requestId}/approve`, {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function settleRedemptionRequest(
  requestId: string,
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("redemptions", `/${requestId}/settle`, {
    method: "POST",
    body: payload,
    appContext,
  });
}
