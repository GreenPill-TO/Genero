import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";

export async function saveStoreProfile(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("store-operations", "/store", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function assignStoreBia(
  storeId: number,
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("store-operations", `/store/${storeId}/bia`, {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function getCityManagerStores(
  input?: {
    status?: string | null;
    limit?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (input?.status) {
    params.set("status", input.status);
  }
  if (typeof input?.limit === "number" && input.limit > 0) {
    params.set("limit", String(input.limit));
  }
  return invokeEdgeFunction<Record<string, unknown>>(
    "store-operations",
    `/city-manager/stores${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function approveCityManagerStore(
  storeId: number,
  payload?: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("store-operations", `/city-manager/stores/${storeId}/approve`, {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function rejectCityManagerStore(
  storeId: number,
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("store-operations", `/city-manager/stores/${storeId}/reject`, {
    method: "POST",
    body: payload,
    appContext,
  });
}
