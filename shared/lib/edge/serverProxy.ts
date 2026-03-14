import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
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

function resolvePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return key;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
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
      headers: {
        "content-type": "application/json",
        apikey: resolvePublishableKey(),
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        "x-app-slug": appContext.appSlug,
        "x-city-slug": appContext.citySlug,
        "x-app-environment": appContext.environment,
      },
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
