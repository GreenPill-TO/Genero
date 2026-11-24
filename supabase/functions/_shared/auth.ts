import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import type { EdgeAppContext } from "./appContext.ts";

type DenoEnv = {
  get(name: string): string | undefined;
};

type DenoLike = {
  env: DenoEnv;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoLike }).Deno;

function requireEnv(name: string): string {
  const value = DenoRuntime?.env.get(name);
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function requireFirstEnv(names: string[]): string {
  for (const name of names) {
    const value = DenoRuntime?.env.get(name);
    if (value) {
      return value;
    }
  }

  throw new Error(`${names.join(" or ")} is required.`);
}

function resolvePublishableKeyFromDictionary(rawValue: string): string | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : Object.values((parsed ?? {}) as Record<string, unknown>);

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.startsWith("sb_publishable_")) {
        return candidate;
      }

      if (candidate && typeof candidate === "object") {
        for (const nested of Object.values(candidate as Record<string, unknown>)) {
          if (typeof nested === "string" && nested.startsWith("sb_publishable_")) {
            return nested;
          }
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function resolveEdgePublishableKey(): string {
  const canonical = DenoRuntime?.env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (canonical) {
    return canonical;
  }

  const publishableKeys = DenoRuntime?.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (publishableKeys) {
    const key = resolvePublishableKeyFromDictionary(publishableKeys);
    if (key) {
      return key;
    }
  }

  return requireFirstEnv(["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]);
}

export function createServiceRoleClient(options?: { purpose?: string }) {
  const purpose = options?.purpose?.trim();
  if (!purpose) {
    throw new Error("A service-role purpose is required for privileged edge access.");
  }

  return createClient(requireFirstEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createAuthenticatedRequestClient(req: Request, options?: { purpose?: string }) {
  const purpose = options?.purpose?.trim();
  if (!purpose) {
    throw new Error("A request-scoped purpose is required for authenticated edge access.");
  }

  const token = resolveBearerToken(req);

  return createClient(
    requireFirstEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    resolveEdgePublishableKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function resolveAuthenticatedEdgeAuthUser(req: Request, options: { purpose: string }) {
  const scopedClient = createAuthenticatedRequestClient(req, { purpose: options.purpose });

  const {
    data: { user: authUser },
    error: authError,
  } = await scopedClient.auth.getUser();

  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  return {
    scopedClient,
    authUser,
  };
}

type EdgeUserRow = {
  id: number | string;
  email: string | null;
  auth_user_id: string | null;
  cubid_id: string | null;
};

type EdgeAppContextInput = {
  appSlug?: string | null;
  citySlug?: string | null;
  environment?: string | null;
};

function throwScopedRpcError(prefix: string, error: { code?: string; message?: string }) {
  const message = error.message ?? "Unknown RPC error";
  if (message === "Unauthorized" || message.startsWith("Forbidden") || error.code === "42501") {
    throw new Error(message);
  }
  throw new Error(`${prefix}: ${message}`);
}

function firstRpcRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return (value as T | null) ?? null;
}

export async function resolveAuthenticatedEdgeContext(
  req: Request,
  options: { purpose: string; input: EdgeAppContextInput }
): Promise<{ scopedClient: any; userRow: EdgeUserRow; appContext: EdgeAppContext }> {
  const { scopedClient, userRow } = await resolveAuthenticatedEdgeUser(req, { purpose: options.purpose });

  const appContext = await resolveEdgeAppContext(scopedClient, options.input);

  return {
    scopedClient,
    userRow,
    appContext,
  };
}

export async function resolveAuthenticatedEdgeUser(
  req: Request,
  options: { purpose: string }
): Promise<{ scopedClient: any; userRow: EdgeUserRow }> {
  const scopedClient = createAuthenticatedRequestClient(req, { purpose: options.purpose });

  const { data: userData, error: userError } = await scopedClient.rpc("edge_resolve_current_user_v1");
  if (userError) {
    throwScopedRpcError("Failed to resolve current user", userError);
  }

  const userRow = firstRpcRow<EdgeUserRow>(userData);
  if (!userRow?.id) {
    throw new Error("Unauthorized");
  }

  return { scopedClient, userRow };
}

export async function resolveEdgeAppContext(
  scopedClient: any,
  input: EdgeAppContextInput
): Promise<EdgeAppContext> {
  const { data: contextData, error: contextError } = await scopedClient.rpc("edge_resolve_app_context_v1", {
    p_app_slug: input.appSlug,
    p_city_slug: input.citySlug,
    p_environment: input.environment || null,
  });
  if (contextError) {
    throwScopedRpcError("Failed to resolve app context", contextError);
  }
  if (!contextData || typeof contextData !== "object") {
    throw new Error("Failed to resolve app context: empty response");
  }

  const context = contextData as Record<string, unknown>;
  const appInstanceId = Number(context.appInstanceId);
  if (!Number.isFinite(appInstanceId) || appInstanceId <= 0) {
    throw new Error("Failed to resolve app context: invalid appInstanceId");
  }

  return {
    appSlug: String(context.appSlug ?? input.appSlug ?? "wallet").trim().toLowerCase(),
    citySlug: String(context.citySlug ?? input.citySlug ?? "tcoin").trim().toLowerCase(),
    environment: String(context.environment ?? input.environment ?? "").trim().toLowerCase(),
    appInstanceId,
  };
}

function resolveBearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new Error("Unauthorized");
  }

  return token;
}
