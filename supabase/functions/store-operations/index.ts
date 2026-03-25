import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  approveCityManagerStore,
  listCityManagerStores,
  rejectCityManagerStore,
} from "../_shared/merchantApplications.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { assignStoreBia, updateStoreRisk, upsertStore } from "../_shared/storeOperations.ts";
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
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/store-operations/, "").replace(/^\/store-operations/, "") || "/";
    const url = new URL(req.url);

    if (req.method === "POST" && pathname === "/store") {
      return jsonResponse(
        req,
        await upsertStore({
          ...base,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && /^\/store\/\d+\/bia$/.test(pathname)) {
      const storeId = Number(pathname.split("/")[2] ?? 0);
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "Invalid store id." }, { status: 400 });
      }

      return jsonResponse(
        req,
        await assignStoreBia({
          ...base,
          storeId,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "GET" && pathname === "/city-manager/stores") {
      const status = (url.searchParams.get("status") ?? "pending").trim().toLowerCase();
      const limit = Math.max(1, Math.min(250, Math.trunc(toNumber(url.searchParams.get("limit"), 50))));
      return jsonResponse(req, await listCityManagerStores({ ...base, status, limit }));
    }

    if (req.method === "POST" && pathname === "/risk") {
      const storeId = Number(body?.storeId ?? 0);
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "storeId must be a positive number." }, { status: 400 });
      }

      return jsonResponse(
        req,
        await updateStoreRisk({
          ...base,
          storeId,
          isSuspended: body?.isSuspended === true,
          reason: typeof body?.reason === "string" ? body.reason : null,
        })
      );
    }

    if (req.method === "POST" && /^\/city-manager\/stores\/\d+\/approve$/.test(pathname)) {
      const storeId = Number(pathname.split("/")[3] ?? 0);
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "Invalid store id." }, { status: 400 });
      }

      return jsonResponse(
        req,
        await approveCityManagerStore({
          ...base,
          storeId,
          reason: typeof body?.reason === "string" ? body.reason.trim() : undefined,
        })
      );
    }

    if (req.method === "POST" && /^\/city-manager\/stores\/\d+\/reject$/.test(pathname)) {
      const storeId = Number(pathname.split("/")[3] ?? 0);
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (!Number.isFinite(storeId) || storeId <= 0) {
        return jsonResponse(req, { error: "Invalid store id." }, { status: 400 });
      }
      if (!reason) {
        return jsonResponse(req, { error: "Rejection reason is required." }, { status: 400 });
      }

      return jsonResponse(req, await rejectCityManagerStore({ ...base, storeId, reason }));
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected store-operations error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("not found")
            ? 404
            : message.includes("required") || message.includes("Only")
              ? 400
              : 500;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
