import { createClient } from "@shared/lib/supabase/client";
import { resolveAppScope } from "./appScope";
import type { AppScopeInput, ResolvedAppScope } from "./types";

type EdgeInvokeOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
  appContext?: AppScopeInput | null;
};

function resolveHeaders(context: ResolvedAppScope): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-app-slug": context.appSlug,
    "x-city-slug": context.citySlug,
    "x-app-environment": context.environment,
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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}${path.startsWith("/") ? path : `/${path}`}`,
    {
      method,
      headers: {
        ...resolveHeaders(context),
        apikey:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
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
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `${functionName} request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
