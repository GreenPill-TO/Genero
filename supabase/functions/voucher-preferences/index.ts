import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { toNumber } from "../_shared/validation.ts";
import { getAddress, isAddress, type Address } from "npm:viem@2.23.3";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

function normalizeOptionalAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

function normalizeTrustStatus(value: unknown): "trusted" | "blocked" | "default" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "trusted" || normalized === "blocked" || normalized === "default") {
    return normalized;
  }
  return null;
}

function buildPreferenceScopeQuery(options: {
  query: any;
  merchantStoreId: number | null;
  tokenAddress: Address | null;
}) {
  let query = options.query;

  if (options.merchantStoreId == null) {
    query = query.is("merchant_store_id", null);
  } else {
    query = query.eq("merchant_store_id", options.merchantStoreId);
  }

  if (options.tokenAddress == null) {
    query = query.is("token_address", null);
  } else {
    query = query.eq("token_address", options.tokenAddress);
  }

  return query;
}

async function readBody(req: Request) {
  if (req.method === "GET" || req.method === "OPTIONS") {
    return null;
  }

  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await readBody(req);
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, body),
    });
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/voucher-preferences/, "").replace(/^\/voucher-preferences/, "") || "/";

    if (req.method === "GET" && pathname === "/preferences") {
      const { data, error } = await auth.serviceRole
        .from("user_voucher_preferences")
        .select("id,city_slug,merchant_store_id,token_address,trust_status,created_at,updated_at")
        .eq("user_id", auth.userRow.id)
        .eq("app_instance_id", appContext.appInstanceId)
        .eq("city_slug", appContext.citySlug)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to load voucher preferences: ${error.message}`);
      }

      return jsonResponse({
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        preferences: data ?? [],
      });
    }

    if (req.method === "PATCH" && pathname === "/preferences") {
      const trustStatus = normalizeTrustStatus(body?.trustStatus);
      if (!trustStatus) {
        return jsonResponse({ error: "trustStatus must be trusted, blocked, or default." }, { status: 400 });
      }

      const merchantStoreIdRaw = toNumber(body?.merchantStoreId, 0);
      const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
      const tokenAddress = normalizeOptionalAddress(body?.tokenAddress);
      const nowIso = new Date().toISOString();

      const existingQuery = buildPreferenceScopeQuery({
        query: auth.serviceRole
          .from("user_voucher_preferences")
          .select("id")
          .eq("user_id", auth.userRow.id)
          .eq("app_instance_id", appContext.appInstanceId)
          .eq("city_slug", appContext.citySlug),
        merchantStoreId,
        tokenAddress,
      });

      const { data: existing, error: existingError } = await existingQuery.limit(1).maybeSingle();
      if (existingError) {
        throw new Error(`Failed to find existing voucher preference: ${existingError.message}`);
      }

      let preference: Record<string, unknown> | null = null;

      if (existing?.id) {
        const { data, error } = await auth.serviceRole
          .from("user_voucher_preferences")
          .update({
            trust_status: trustStatus,
            updated_at: nowIso,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) {
          throw new Error(`Failed to update voucher preference: ${error.message}`);
        }

        preference = data;
      } else {
        const { data, error } = await auth.serviceRole
          .from("user_voucher_preferences")
          .insert({
            user_id: auth.userRow.id,
            app_instance_id: appContext.appInstanceId,
            city_slug: appContext.citySlug,
            merchant_store_id: merchantStoreId,
            token_address: tokenAddress,
            trust_status: trustStatus,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(`Failed to create voucher preference: ${error.message}`);
        }

        preference = data;
      }

      await auth.serviceRole.from("governance_actions_log").insert({
        action_type: "voucher_preference_updated",
        city_slug: appContext.citySlug,
        actor_user_id: auth.userRow.id,
        reason: "User updated voucher routing preferences",
        payload: {
          appInstanceId: appContext.appInstanceId,
          merchantStoreId,
          tokenAddress,
          trustStatus,
        },
      });

      return jsonResponse({ preference });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher-preferences error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
