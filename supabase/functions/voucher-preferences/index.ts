import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { assertAdminOrOperator } from "../_shared/rbac.ts";
import { toNumber } from "../_shared/validation.ts";
import { getAddress, isAddress, type Address } from "npm:viem@2.23.3";
import { getVoucherCompatibilityRules, listMerchantsForVoucherScope, resolveActiveUserBiaSet } from "../_shared/voucherRouting.ts";

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

export async function handleRequest(req: Request): Promise<Response> {
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

    if (req.method === "GET" && pathname === "/compatibility") {
      const chainId = Math.max(1, Math.trunc(toNumber(new URL(req.url).searchParams.get("chainId"), 42220)));
      const rules = await getVoucherCompatibilityRules({
        supabase: auth.serviceRole,
        citySlug: appContext.citySlug,
        chainId,
      });

      return jsonResponse({
        citySlug: appContext.citySlug,
        chainId,
        rules,
      });
    }

    if (req.method === "POST" && pathname === "/compatibility") {
      await assertAdminOrOperator({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
      });

      const chainId = Math.max(1, Math.trunc(toNumber(body?.chainId, 42220)));
      const poolAddress = normalizeOptionalAddress(body?.poolAddress);
      const tokenAddress = normalizeOptionalAddress(body?.tokenAddress);
      if (!poolAddress || !tokenAddress) {
        return jsonResponse({ error: "poolAddress and tokenAddress are required." }, { status: 400 });
      }

      const merchantStoreIdRaw = toNumber(body?.merchantStoreId, 0);
      const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
      const acceptedByDefault = body?.acceptedByDefault !== false;
      const ruleStatus = body?.ruleStatus === "inactive" ? "inactive" : "active";
      const nowIso = new Date().toISOString();

      let existingQuery = auth.serviceRole
        .from("voucher_compatibility_rules")
        .select("id")
        .eq("city_slug", appContext.citySlug)
        .eq("chain_id", chainId)
        .eq("pool_address", poolAddress)
        .eq("token_address", tokenAddress);

      if (merchantStoreId == null) {
        existingQuery = existingQuery.is("merchant_store_id", null);
      } else {
        existingQuery = existingQuery.eq("merchant_store_id", merchantStoreId);
      }

      const { data: existing, error: existingError } = await existingQuery.limit(1).maybeSingle();
      if (existingError) {
        throw new Error(`Failed to check existing compatibility rule: ${existingError.message}`);
      }

      let saved: Record<string, unknown> | null = null;
      if (existing?.id) {
        const { data, error } = await auth.serviceRole
          .from("voucher_compatibility_rules")
          .update({
            accepted_by_default: acceptedByDefault,
            rule_status: ruleStatus,
            updated_at: nowIso,
            created_by: auth.userRow.id,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) {
          throw new Error(`Failed to update compatibility rule: ${error.message}`);
        }
        saved = data;
      } else {
        const { data, error } = await auth.serviceRole
          .from("voucher_compatibility_rules")
          .insert({
            city_slug: appContext.citySlug,
            chain_id: chainId,
            pool_address: poolAddress,
            token_address: tokenAddress,
            merchant_store_id: merchantStoreId,
            accepted_by_default: acceptedByDefault,
            rule_status: ruleStatus,
            created_by: auth.userRow.id,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(`Failed to create compatibility rule: ${error.message}`);
        }
        saved = data;
      }

      await auth.serviceRole.from("governance_actions_log").insert({
        action_type: "voucher_compatibility_updated",
        city_slug: appContext.citySlug,
        actor_user_id: auth.userRow.id,
        reason:
          typeof body?.reason === "string" && body.reason.trim() !== ""
            ? body.reason.trim()
            : "Voucher compatibility rule updated",
        payload: {
          appInstanceId: appContext.appInstanceId,
          chainId,
          poolAddress,
          tokenAddress,
          merchantStoreId,
          acceptedByDefault,
          ruleStatus,
        },
      });

      return jsonResponse({ rule: saved });
    }

    if (req.method === "GET" && pathname === "/merchants") {
      const url = new URL(req.url);
      const chainId = Math.max(1, Math.trunc(toNumber(url.searchParams.get("chainId"), 42220)));
      const scopeRaw = (url.searchParams.get("scope") ?? "my_pool").trim().toLowerCase();
      const scope = scopeRaw === "city" ? "city" : "my_pool";

      const [merchantResult, userBiaScope] = await Promise.all([
        listMerchantsForVoucherScope({
          supabase: auth.serviceRole,
          citySlug: appContext.citySlug,
          chainId,
          userId: Number(auth.userRow.id),
          appInstanceId: appContext.appInstanceId,
          scope,
        }),
        resolveActiveUserBiaSet({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appInstanceId: appContext.appInstanceId,
        }),
      ]);

      return jsonResponse({
        citySlug: appContext.citySlug,
        chainId,
        state: merchantResult.state,
        setupMessage: merchantResult.setupMessage,
        scope,
        liquiditySource: "sarafu_onchain",
        readOnly: true,
        appInstanceId: appContext.appInstanceId,
        biaScope: {
          primaryBiaId: userBiaScope.primaryBiaId,
          secondaryBiaIds: userBiaScope.secondaryBiaIds,
        },
        merchants: merchantResult.merchants,
      });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher-preferences error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
