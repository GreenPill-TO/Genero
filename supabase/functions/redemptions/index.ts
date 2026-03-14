import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  approveRedemption,
  createRedemptionRequest,
  listRedemptionRequests,
  settleRedemption,
} from "../_shared/redemptions.ts";
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
    const base = {
      supabase: auth.serviceRole,
      userId: Number(auth.userRow.id),
      appContext,
    };

    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/redemptions/, "").replace(/^\/redemptions/, "") || "/";
    const url = new URL(req.url);

    if (req.method === "POST" && pathname === "/request") {
      return jsonResponse(await createRedemptionRequest({ ...base, payload: body ?? {} }));
    }

    if (req.method === "GET" && pathname === "/list") {
      return jsonResponse(
        await listRedemptionRequests({
          ...base,
          statusFilter: url.searchParams.get("status")?.trim().toLowerCase() ?? null,
          storeIdFilter: toNumber(url.searchParams.get("storeId"), 0),
          limit: Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50))),
        })
      );
    }

    if (req.method === "POST" && /^\/[^/]+\/approve$/.test(pathname)) {
      const requestId = pathname.split("/")[1] ?? "";
      if (!requestId) {
        return jsonResponse({ error: "Request id is required." }, { status: 400 });
      }
      return jsonResponse(await approveRedemption({ ...base, requestId, payload: body ?? {} }));
    }

    if (req.method === "POST" && /^\/[^/]+\/settle$/.test(pathname)) {
      const requestId = pathname.split("/")[1] ?? "";
      if (!requestId) {
        return jsonResponse({ error: "Request id is required." }, { status: 400 });
      }
      return jsonResponse(await settleRedemption({ ...base, requestId, payload: body ?? {} }));
    }

    return jsonResponse({ error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected redemptions error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("not found")
            ? 404
            : message.includes("required") || message.includes("Invalid")
              ? 400
              : 500;
    return jsonResponse({ error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
