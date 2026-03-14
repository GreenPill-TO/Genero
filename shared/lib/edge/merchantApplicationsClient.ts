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
