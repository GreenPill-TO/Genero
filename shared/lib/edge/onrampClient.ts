import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  CreateOnrampSessionRequest,
  CreateOnrampSessionResponse,
  LegacyRampAdminRequestsResponse,
  OnrampAdminSessionsResponse,
  OnrampStatusResponse,
  OnrampTouchResponse,
  RetryOnrampSessionResponse,
} from "./onramp";

export async function createOnrampSession(
  payload: CreateOnrampSessionRequest,
  appContext?: AppScopeInput | null
): Promise<CreateOnrampSessionResponse> {
  return invokeEdgeFunction<CreateOnrampSessionResponse>("onramp", "/session", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function getOnrampSession(
  sessionId: string,
  appContext?: AppScopeInput | null
): Promise<OnrampStatusResponse> {
  return invokeEdgeFunction<OnrampStatusResponse>("onramp", `/session/${sessionId}`, {
    method: "GET",
    appContext,
  });
}

export async function updateOnrampSession(
  sessionId: string,
  payload: { action: "widget_opened" },
  appContext?: AppScopeInput | null
): Promise<OnrampStatusResponse> {
  return invokeEdgeFunction<OnrampStatusResponse>("onramp", `/session/${sessionId}`, {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function touchOnrampSessions(
  appContext?: AppScopeInput | null
): Promise<OnrampTouchResponse> {
  return invokeEdgeFunction<OnrampTouchResponse>("onramp", "/touch", {
    method: "POST",
    appContext,
  });
}

export async function getAdminOnrampSessions(
  input?: {
    limit?: number | null;
    status?: string | null;
    userId?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<OnrampAdminSessionsResponse> {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && input.limit > 0) {
    params.set("limit", String(input.limit));
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  if (typeof input?.userId === "number" && input.userId > 0) {
    params.set("userId", String(input.userId));
  }

  return invokeEdgeFunction<OnrampAdminSessionsResponse>(
    "onramp",
    `/admin/sessions${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}

export async function retryOnrampSession(
  sessionId: string,
  payload?: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<RetryOnrampSessionResponse> {
  return invokeEdgeFunction<RetryOnrampSessionResponse>("onramp", `/session/${sessionId}/retry`, {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function getOnrampAdminRequests(
  appContext?: AppScopeInput | null
): Promise<LegacyRampAdminRequestsResponse> {
  return invokeEdgeFunction<LegacyRampAdminRequestsResponse>("onramp", "/admin/requests", {
    method: "GET",
    appContext,
  });
}

export async function createLegacyInteracReference(
  payload: { amount: number | string; refCode: string },
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("onramp", "/legacy/interac/reference", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function confirmLegacyInteracReference(
  payload: { refCode: string },
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("onramp", "/legacy/interac/confirm", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
    appContext,
  });
}

export async function createPoolPurchaseRequest(
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("onramp", "/pool-purchase-request", {
    method: "POST",
    body: payload,
    appContext,
  });
}

export async function updateLegacyInteracAdminRequest(
  requestId: number,
  payload: Record<string, unknown>,
  appContext?: AppScopeInput | null
): Promise<Record<string, unknown>> {
  return invokeEdgeFunction<Record<string, unknown>>("onramp", `/admin/requests/interac/${requestId}`, {
    method: "PATCH",
    body: payload,
    appContext,
  });
}
