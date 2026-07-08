import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";

export async function getMerchantApplicationStatus(appContext?: AppScopeInput | null): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("merchant-applications", "/status", {
    method: "GET",
    appContext,
  });
}

export async function startMerchantApplication(
  payload?: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("merchant-applications", "/start", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function restartMerchantApplication(
  payload?: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("merchant-applications", "/restart", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function saveMerchantApplicationStep(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("merchant-applications", "/step", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function submitMerchantApplication(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("merchant-applications", "/submit", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function checkMerchantSlugAvailability(
  input: {
    slug: string;
    excludeStoreId?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  params.set("slug", input.slug);
  if (typeof input.excludeStoreId === "number" && input.excludeStoreId > 0) {
    params.set("excludeStoreId", String(input.excludeStoreId));
  }

  return invokeEdgeFunction<Record<string, unknown>>(
    "merchant-applications",
    `/slug-availability?${params.toString()}`,
    {
      method: "GET",
      appContext: input.appContext,
    }
  );
}
