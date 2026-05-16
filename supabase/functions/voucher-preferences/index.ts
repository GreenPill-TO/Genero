import {
  createAuthenticatedRequestClient,
  createServiceRoleClient,
  resolveAuthenticatedEdgeContext,
} from "../_shared/auth.ts";
import { resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
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

function throwRpcError(prefix: string, error: { code?: string; message?: string }) {
  const message = error.message ?? "Unknown RPC error";
  if (message === "Unauthorized" || message.startsWith("Forbidden") || error.code === "42501") {
    throw new Error(message);
  }
  throw new Error(`${prefix}: ${message}`);
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
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const body = await readBody(req);
    const appContextInput = resolveAppContextInput(req, body);
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/voucher-preferences/, "").replace(/^\/voucher-preferences/, "") || "/";

    if (req.method === "GET" && pathname === "/preferences") {
      const scopedClient = createAuthenticatedRequestClient(req, {
        purpose: "voucher preference self-service read",
      });
      const { data, error } = await scopedClient.rpc("edge_list_voucher_preferences_v1", {
        p_app_slug: appContextInput.appSlug,
        p_city_slug: appContextInput.citySlug,
        p_environment: appContextInput.environment || null,
      });

      if (error) {
        throwRpcError("Failed to load voucher preferences", error);
      }
      if (!data) {
        throw new Error("Failed to load voucher preferences: empty response");
      }

      return jsonResponse(req, data);
    }

    if (req.method === "PATCH" && pathname === "/preferences") {
      const trustStatus = normalizeTrustStatus(body?.trustStatus);
      if (!trustStatus) {
        return jsonResponse(req, { error: "trustStatus must be trusted, blocked, or default." }, { status: 400 });
      }

      const merchantStoreIdRaw = toNumber(body?.merchantStoreId, 0);
      const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
      const tokenAddress = normalizeOptionalAddress(body?.tokenAddress);
      const scopedClient = createAuthenticatedRequestClient(req, {
        purpose: "voucher preference self-service write",
      });
      const { data, error } = await scopedClient.rpc("edge_upsert_voucher_preference_v1", {
        p_app_slug: appContextInput.appSlug,
        p_city_slug: appContextInput.citySlug,
        p_environment: appContextInput.environment || null,
        p_merchant_store_id: merchantStoreId,
        p_token_address: tokenAddress,
        p_trust_status: trustStatus,
      });

      if (error) {
        throwRpcError("Failed to save voucher preference", error);
      }
      if (!data) {
        throw new Error("Failed to save voucher preference: empty response");
      }

      return jsonResponse(req, data);
    }

    const scoped = await resolveAuthenticatedEdgeContext(req, {
      purpose: "voucher preferences privileged scoped identity and app context",
      input: appContextInput,
    });
    const serviceRole = createServiceRoleClient({ purpose: `voucher preferences ${pathname} operation` });

    if (req.method === "GET" && pathname === "/compatibility") {
      const chainId = Math.max(1, Math.trunc(toNumber(new URL(req.url).searchParams.get("chainId"), 42220)));
      const rules = await getVoucherCompatibilityRules({
        supabase: serviceRole,
        citySlug: scoped.appContext.citySlug,
        chainId,
      });

      return jsonResponse(req, {
        citySlug: scoped.appContext.citySlug,
        chainId,
        rules,
      });
    }

    if (req.method === "POST" && pathname === "/compatibility") {
      await assertAdminOrOperator({
        supabase: serviceRole,
        userId: Number(scoped.userRow.id),
        appInstanceId: scoped.appContext.appInstanceId,
      });

      const chainId = Math.max(1, Math.trunc(toNumber(body?.chainId, 42220)));
      const poolAddress = normalizeOptionalAddress(body?.poolAddress);
      const tokenAddress = normalizeOptionalAddress(body?.tokenAddress);
      if (!poolAddress || !tokenAddress) {
        return jsonResponse(req, { error: "poolAddress and tokenAddress are required." }, { status: 400 });
      }

      const merchantStoreIdRaw = toNumber(body?.merchantStoreId, 0);
      const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
      const acceptedByDefault = body?.acceptedByDefault !== false;
      const ruleStatus = body?.ruleStatus === "inactive" ? "inactive" : "active";
      const nowIso = new Date().toISOString();

      let existingQuery = serviceRole
        .from("voucher_compatibility_rules")
        .select("id")
        .eq("city_slug", scoped.appContext.citySlug)
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
        const { data, error } = await serviceRole
          .from("voucher_compatibility_rules")
          .update({
            accepted_by_default: acceptedByDefault,
            rule_status: ruleStatus,
            updated_at: nowIso,
            created_by: scoped.userRow.id,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) {
          throw new Error(`Failed to update compatibility rule: ${error.message}`);
        }
        saved = data;
      } else {
        const { data, error } = await serviceRole
          .from("voucher_compatibility_rules")
          .insert({
            city_slug: scoped.appContext.citySlug,
            chain_id: chainId,
            pool_address: poolAddress,
            token_address: tokenAddress,
            merchant_store_id: merchantStoreId,
            accepted_by_default: acceptedByDefault,
            rule_status: ruleStatus,
            created_by: scoped.userRow.id,
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

      await serviceRole.from("governance_actions_log").insert({
        action_type: "voucher_compatibility_updated",
        city_slug: scoped.appContext.citySlug,
        actor_user_id: scoped.userRow.id,
        reason:
          typeof body?.reason === "string" && body.reason.trim() !== ""
            ? body.reason.trim()
            : "Voucher compatibility rule updated",
        payload: {
          appInstanceId: scoped.appContext.appInstanceId,
          chainId,
          poolAddress,
          tokenAddress,
          merchantStoreId,
          acceptedByDefault,
          ruleStatus,
        },
      });

      return jsonResponse(req, { rule: saved });
    }

    if (req.method === "GET" && pathname === "/merchants") {
      const url = new URL(req.url);
      const chainId = Math.max(1, Math.trunc(toNumber(url.searchParams.get("chainId"), 42220)));
      const scopeRaw = (url.searchParams.get("scope") ?? "my_pool").trim().toLowerCase();
      const scope = scopeRaw === "city" ? "city" : "my_pool";

      const [merchantResult, userBiaScope] = await Promise.all([
        listMerchantsForVoucherScope({
          supabase: serviceRole,
          citySlug: scoped.appContext.citySlug,
          chainId,
          userId: Number(scoped.userRow.id),
          appInstanceId: scoped.appContext.appInstanceId,
          scope,
        }),
        resolveActiveUserBiaSet({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appInstanceId: scoped.appContext.appInstanceId,
        }),
      ]);

      return jsonResponse(req, {
        citySlug: scoped.appContext.citySlug,
        chainId,
        state: merchantResult.state,
        setupMessage: merchantResult.setupMessage,
        scope,
        liquiditySource: "sarafu_onchain",
        readOnly: true,
        appInstanceId: scoped.appContext.appInstanceId,
        biaScope: {
          primaryBiaId: userBiaScope.primaryBiaId,
          secondaryBiaIds: userBiaScope.secondaryBiaIds,
        },
        merchants: merchantResult.merchants,
      });
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher-preferences error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
