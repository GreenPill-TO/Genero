import { createClient } from "@shared/lib/supabase/client";
import { resolveAccessToken } from "@shared/lib/supabase/session";
import { resolveAppScope } from "./appScope";
import type { AppScopeInput, ResolvedAppScope } from "./types";

type EdgeInvokeOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
  appContext?: AppScopeInput | null;
};

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  return url;
}

function resolvePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error("Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return key;
}

function resolveHeaders(context: ResolvedAppScope, accessToken?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    apikey: resolvePublishableKey(),
    "x-app-slug": context.appSlug,
    "x-city-slug": context.citySlug,
    "x-app-environment": context.environment,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  path: string,
  options?: EdgeInvokeOptions
): Promise<T> {
  const supabase = createClient();
  const context = resolveAppScope(options?.appContext);
  const method = options?.method ?? "GET";
  const accessToken = await resolveAccessToken(supabase);

  const response = await fetch(
    `${resolveSupabaseUrl()}/functions/v1/${functionName}${normalizePath(path)}`,
    {
      method,
      headers: resolveHeaders(context, accessToken ?? undefined),
      body:
        method === "GET"
          ? undefined
          : JSON.stringify({
              ...(options?.body ?? {}),
              appContext: context,
            }),
    }
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const normalizedPath = normalizePath(path);
    const payloadError =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : null;
    const message =
      response.status === 404 && (!payloadError || payloadError === "Not found.")
        ? `${functionName} route ${normalizedPath} is not available in this environment.`
        : payloadError ?? `${functionName} request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
