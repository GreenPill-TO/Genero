import { createServiceRoleClient, resolveAuthenticatedEdgeContext } from "../_shared/auth.ts";
import { resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { userHasAnyRole } from "../_shared/rbac.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const scoped = await resolveAuthenticatedEdgeContext(req, {
      purpose: "control-plane scoped identity and app context",
      input: resolveAppContextInput(req, null),
    });
    const serviceRole = createServiceRoleClient({ purpose: "control-plane access role check" });
    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/control-plane/, "").replace(/^\/control-plane/, "") || "/";

    if (req.method === "GET" && pathname === "/access") {
      const isAdminOrOperator = await userHasAnyRole({
        supabase: serviceRole,
        userId: Number(scoped.userRow.id),
        appInstanceId: scoped.appContext.appInstanceId,
        roles: ["admin", "operator"],
      });

      return jsonResponse(req, {
        citySlug: scoped.appContext.citySlug,
        appInstanceId: scoped.appContext.appInstanceId,
        isAdminOrOperator,
        canAccessAdminDashboard: isAdminOrOperator,
        canAccessCityManager: isAdminOrOperator,
      });
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected control-plane error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
