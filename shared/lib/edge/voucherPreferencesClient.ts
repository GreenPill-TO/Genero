import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  SaveVoucherCompatibilityInput,
  VoucherCompatibilityResponse,
  VoucherMerchantsResponse,
  VoucherPreferencesResponse,
} from "./vouchers";

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

export async function getVoucherCompatibilityRules(
  input?: {
    chainId?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<VoucherCompatibilityResponse> {
  const params = new URLSearchParams();
  if (typeof input?.chainId === "number" && input.chainId > 0) {
    params.set("chainId", String(input.chainId));
  }

  return invokeEdgeFunction<VoucherCompatibilityResponse>(
    "voucher-preferences",
    `/compatibility${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function saveVoucherCompatibilityRule(
  payload: SaveVoucherCompatibilityInput,
  appContext?: AppScopeInput | null
): Promise<{ rule: Record<string, unknown> }> {
  return invokeEdgeFunction<{ rule: Record<string, unknown> }>("voucher-preferences", "/compatibility", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function getVoucherMerchants(
  input?: {
    chainId?: number | null;
    scope?: "city" | "my_pool";
    appContext?: AppScopeInput | null;
  }
): Promise<VoucherMerchantsResponse> {
  const params = new URLSearchParams();
  if (typeof input?.chainId === "number" && input.chainId > 0) {
    params.set("chainId", String(input.chainId));
  }
  if (input?.scope) {
    params.set("scope", input.scope);
  }

  return invokeEdgeFunction<VoucherMerchantsResponse>(
    "voucher-preferences",
    `/merchants${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}
