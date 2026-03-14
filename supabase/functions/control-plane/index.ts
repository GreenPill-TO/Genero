import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { userHasAnyRole } from "../_shared/rbac.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, null),
    });
    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/control-plane/, "").replace(/^\/control-plane/, "") || "/";

    if (req.method === "GET" && pathname === "/access") {
      const isAdminOrOperator = await userHasAnyRole({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        roles: ["admin", "operator"],
      });

      return jsonResponse({
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        isAdminOrOperator,
        canAccessAdminDashboard: isAdminOrOperator,
        canAccessCityManager: isAdminOrOperator,
      });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected control-plane error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
