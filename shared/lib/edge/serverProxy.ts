import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { resolveSupabasePublishableKey } from "@shared/lib/supabase/env";
import { resolveAppScope, type AppScopeInput } from "./appScope";

type ProxyEdgeRequestOptions = {
  req: Request;
  functionName: string;
  path: string;
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown> | null;
  appContext?: AppScopeInput | null;
  requireAuth?: boolean;
};

function resolveSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  return url;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildProxyHeaders(options: {
  accessToken?: string;
  appContext: ReturnType<typeof resolveAppScope>;
}): Record<string, string> {
  return {
    "content-type": "application/json",
    apikey: resolveSupabasePublishableKey(),
    "x-app-slug": options.appContext.appSlug,
    "x-city-slug": options.appContext.citySlug,
    "x-app-environment": options.appContext.environment,
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
  };
}

export async function proxyEdgeRequest(options: ProxyEdgeRequestOptions): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (options.requireAuth !== false && !session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appContext = resolveAppScope(options.appContext);
  const response = await fetch(
    `${resolveSupabaseUrl()}/functions/v1/${options.functionName}${normalizePath(options.path)}`,
    {
      method: options.method ?? options.req.method.toUpperCase(),
      headers: buildProxyHeaders({
        accessToken: session?.access_token,
        appContext,
      }),
      body:
        (options.method ?? options.req.method.toUpperCase()) === "GET"
          ? undefined
          : JSON.stringify({
              ...(options.body ?? {}),
              appContext,
            }),
    }
  );

  const text = await response.text();
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") ?? "application/json");

  return new NextResponse(text || null, {
    status: response.status,
    headers,
  });
}
