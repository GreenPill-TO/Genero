import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { toNumber } from "../_shared/validation.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, null),
    });

    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/governance/, "").replace(/^\/governance/, "") || "/";
    const url = new URL(req.url);

    if (req.method === "GET" && pathname === "/actions") {
      const biaId = url.searchParams.get("biaId");
      const storeId = toNumber(url.searchParams.get("storeId"), 0);
      const limit = Math.max(1, Math.min(200, Math.trunc(toNumber(url.searchParams.get("limit"), 100))));

      let query = auth.serviceRole
        .from("governance_actions_log")
        .select("*")
        .eq("city_slug", appContext.citySlug)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (biaId) {
        query = query.eq("bia_id", biaId);
      }
      if (Number.isFinite(storeId) && storeId > 0) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to load governance action feed: ${error.message}`);
      }

      return jsonResponse(req, {
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        actions: data ?? [],
      });
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected governance error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
