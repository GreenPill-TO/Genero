import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { VoucherPreferencesResponse } from "./vouchers";

export async function getVoucherPreferences(appContext?: AppScopeInput | null): Promise<VoucherPreferencesResponse> {
  return invokeEdgeFunction<VoucherPreferencesResponse>("voucher-preferences", "/preferences", {
    method: "GET",
    appContext,
  });
}

export async function updateVoucherPreferences(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<{ preference: Record<string, unknown> }> {
  return invokeEdgeFunction<{ preference: Record<string, unknown> }>("voucher-preferences", "/preferences", {
    method: "PATCH",
    body: payload,
    appContext,
  });
}
