import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createOnrampSession,
  getOnrampSessionStatus,
  listLegacyRampAdminRequests,
  listOnrampAdminSessions,
  markOnrampSessionAction,
  retryOnrampSession,
  touchOnrampSessionsForUser,
} from "../_shared/onramp.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { toNumber } from "../_shared/validation.ts";

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
    const pathname = rawPathname.replace(/^\/functions\/v1\/onramp/, "").replace(/^\/onramp/, "") || "/";
    const url = new URL(req.url);

    if (req.method === "POST" && pathname === "/session") {
      const result = await createOnrampSession({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        citySlug: appContext.citySlug,
        fiatAmount: toNumber(body?.fiatAmount, 0),
        fiatCurrency: typeof body?.fiatCurrency === "string" ? body.fiatCurrency : "CAD",
        countryCode: typeof body?.countryCode === "string" ? body.countryCode : null,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "GET" && /^\/session\/[^/]+$/.test(pathname)) {
      const sessionId = pathname.split("/")[2] ?? "";
      const result = await getOnrampSessionStatus({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        sessionId,
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "POST" && /^\/session\/[^/]+$/.test(pathname)) {
      const sessionId = pathname.split("/")[2] ?? "";
      const result = await markOnrampSessionAction({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        sessionId,
        citySlug: appContext.citySlug,
        appInstanceId: appContext.appInstanceId,
        action: typeof body?.action === "string" ? body.action : undefined,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "POST" && /^\/session\/[^/]+\/retry$/.test(pathname)) {
      const sessionId = pathname.split("/")[2] ?? "";
      const result = await retryOnrampSession({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        sessionId,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "POST" && pathname === "/touch") {
      const result = await touchOnrampSessionsForUser({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        citySlug: appContext.citySlug,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "GET" && pathname === "/admin/sessions") {
      const result = await listOnrampAdminSessions({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        citySlug: appContext.citySlug,
        limit: Math.max(1, Math.min(200, Math.trunc(toNumber(url.searchParams.get("limit"), 50)))),
        status: url.searchParams.get("status")?.trim().toLowerCase() ?? null,
        targetUserId: Math.trunc(toNumber(url.searchParams.get("userId"), 0)),
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    if (req.method === "GET" && pathname === "/admin/requests") {
      const result = await listLegacyRampAdminRequests({
        supabase: auth.serviceRole,
        userId: Number(auth.userRow.id),
        appInstanceId: appContext.appInstanceId,
        citySlug: appContext.citySlug,
      });
      return jsonResponse(req, result.body, { status: result.status });
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("not found")
            ? 404
            : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
