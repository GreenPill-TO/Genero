import { createServiceRoleClient, resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { userHasAnyRole } from "../_shared/rbac.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

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
    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/user-requests/, "").replace(/^\/user-requests/, "") || "/";

    if (req.method === "POST" && pathname === "/create") {
      const serviceRole = createServiceRoleClient();
      const appContext = await resolveActiveAppContext({
        supabase: serviceRole,
        input: resolveAppContextInput(req, body),
      });

      const ipCandidates = [
        req.headers.get("x-forwarded-for"),
        req.headers.get("x-real-ip"),
        req.headers.get("cf-connecting-ip"),
        req.headers.get("x-client-ip"),
      ];
      const ipAddresses = ipCandidates.filter(Boolean).map((value) => String(value).split(",")[0].trim());

      const payload: Record<string, unknown> = {
        name: typeof body?.name === "string" ? body.name : null,
        email: typeof body?.email === "string" ? body.email : null,
        message: typeof body?.message === "string" ? body.message : null,
        ip_addresses: ipAddresses,
        app_instance_id: appContext.appInstanceId,
      };

      const { error } = await serviceRole.from("user_requests").insert(payload);
      if (error) {
        throw new Error(error.message);
      }

      return jsonResponse({ success: true });
    }

    if (req.method === "GET" && pathname === "/list") {
      const auth = await resolveAuthenticatedUser(req);
      const appContext = await resolveActiveAppContext({
        supabase: auth.serviceRole,
        input: resolveAppContextInput(req, body),
      });
      const isAdminOrOperator = await userHasAnyRole({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        roles: ["admin", "operator"],
      });

      if (!isAdminOrOperator) {
        throw new Error("Forbidden: admin/operator role required.");
      }

      const { data, error } = await auth.serviceRole
        .from("user_requests")
        .select("*")
        .eq("app_instance_id", appContext.appInstanceId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to load user requests: ${error.message}`);
      }

      return jsonResponse({
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        requests: data ?? [],
      });
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected user-requests error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 400;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
