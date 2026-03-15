import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  getMerchantStatus,
  restartMerchantApplication,
  saveMerchantApplicationStep,
  startMerchantApplication,
  submitMerchantApplication,
} from "../_shared/merchantApplications.ts";

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
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/merchant-applications/, "").replace(/^\/merchant-applications/, "") || "/";

    if (req.method === "GET" && pathname === "/status") {
      return jsonResponse(req, await getMerchantStatus(base));
    }

    if (req.method === "POST" && pathname === "/start") {
      return jsonResponse(req, await startMerchantApplication({ ...base, forceNew: body?.forceNew === true }));
    }

    if (req.method === "POST" && pathname === "/restart") {
      return jsonResponse(req, await restartMerchantApplication(base));
    }

    if (req.method === "POST" && pathname === "/step") {
      const storeId = Number(body?.storeId ?? 0);
      const step = Number(body?.step ?? 0);

      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "storeId must be a positive number." }, { status: 400 });
      }
      if (!Number.isFinite(step) || step < 1 || step > 5) {
        return jsonResponse(req, { error: "step must be between 1 and 5." }, { status: 400 });
      }

      return jsonResponse(
        req,
        await saveMerchantApplicationStep({
          ...base,
          storeId,
          step,
          payload: body?.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/submit") {
      const storeId = Number(body?.storeId ?? 0);
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "storeId must be a positive number." }, { status: 400 });
      }

      const result = await submitMerchantApplication({ ...base, storeId });
      if ("error" in result) {
        return jsonResponse(req, result, { status: 400 });
      }
      return jsonResponse(req, result);
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected merchant-applications error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("Only")
            ? 409
            : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
