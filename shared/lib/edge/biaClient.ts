import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { BiaListResponse, BiaMappingsResponse } from "./bia";

type BiaControlsResponse = {
  citySlug: string;
  canAdminister: boolean;
  controls: unknown[];
};

export async function getBiaList(
  input?: {
    includeMappings?: boolean;
    appContext?: AppScopeInput | null;
  }
): Promise<BiaListResponse> {
  const includeMappings = input?.includeMappings === true ? "?includeMappings=true" : "";
  return invokeEdgeFunction<BiaListResponse>("bia-service", `/list${includeMappings}`, {
    method: "GET",
    appContext: input?.appContext,
  });
}

export async function getBiaMappings(
  input?: {
    chainId?: number;
    includeHealth?: boolean;
    appContext?: AppScopeInput | null;
  }
): Promise<BiaMappingsResponse> {
  const params = new URLSearchParams();
  if (typeof input?.chainId === "number") {
    params.set("chainId", String(input.chainId));
  }
  if (typeof input?.includeHealth === "boolean") {
    params.set("includeHealth", String(input.includeHealth));
  }
  return invokeEdgeFunction<BiaMappingsResponse>(
    "bia-service",
    `/mappings${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function saveBiaMappings(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<BiaMappingsResponse> {
  return invokeEdgeFunction<BiaMappingsResponse>("bia-service", "/mappings", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function getBiaControls(appContext?: AppScopeInput | null): Promise<BiaControlsResponse> {
  return invokeEdgeFunction<BiaControlsResponse>("bia-service", "/controls", {
    method: "GET",
    appContext,
  });
}

export async function saveBiaControls(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<{ controls: unknown }> {
  return invokeEdgeFunction<{ controls: unknown }>("bia-service", "/controls", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function createBia(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<{ bia: unknown }> {
  return invokeEdgeFunction<{ bia: unknown }>("bia-service", "/create", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function selectUserBia(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<{ affiliation: unknown; secondaryAffiliationCount: number }> {
  return invokeEdgeFunction<{ affiliation: unknown; secondaryAffiliationCount: number }>("bia-service", "/select", {
    method: "POST",
    body: payload,
    appContext,
  });
}
