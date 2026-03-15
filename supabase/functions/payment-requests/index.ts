import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  cancelPaymentRequest,
  createPaymentRequest,
  dismissPaymentRequest,
  listIncomingPaymentRequests,
  listOutgoingPaymentRequests,
  listRecentPaymentRequestParticipants,
  markPaymentRequestPaid,
} from "../_shared/paymentRequests.ts";

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

async function resolveCityScope(options: {
  req: Request;
  body: Record<string, unknown> | null;
  supabase: any;
}) {
  const url = new URL(options.req.url);
  const queryCitySlug = url.searchParams.get("citySlug")?.trim().toLowerCase() ?? "";
  const bodyCitySlug =
    typeof options.body?.citySlug === "string" ? options.body.citySlug.trim().toLowerCase() : "";
  const requestedCitySlug = queryCitySlug || bodyCitySlug;
  const nestedAppContext =
    options.body?.appContext && typeof options.body.appContext === "object"
      ? (options.body.appContext as Record<string, unknown>)
      : null;
  const hasAppContext =
    nestedAppContext != null ||
    options.req.headers.has("x-app-slug") ||
    options.req.headers.has("x-city-slug") ||
    options.req.headers.has("x-app-environment");

  let appContext: Awaited<ReturnType<typeof resolveActiveAppContext>> | null = null;
  if (hasAppContext) {
    appContext = await resolveActiveAppContext({
      supabase: options.supabase,
      input: resolveAppContextInput(options.req, options.body),
    });
  }

  if (requestedCitySlug && appContext?.citySlug && requestedCitySlug !== appContext.citySlug) {
    throw new Error("City scope mismatch between citySlug and appContext.");
  }

  const citySlug = requestedCitySlug || appContext?.citySlug;
  if (!citySlug) {
    throw new Error("City slug is required.");
  }

  const { data: cityRow, error: cityError } = await options.supabase
    .from("ref_citycoins")
    .select("id,slug")
    .eq("slug", citySlug)
    .limit(1)
    .maybeSingle();

  if (cityError) {
    throw new Error(`Failed to resolve city scope: ${cityError.message}`);
  }
  if (!cityRow?.id) {
    throw new Error(`No city coin found for slug='${citySlug}'.`);
  }

  return {
    citycoinId: Number(cityRow.id),
    citySlug,
    appInstanceId: appContext?.appInstanceId ?? null,
  };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await resolveAuthenticatedUser(req);
    const body = await readBody(req);
    const cityScope = await resolveCityScope({
      req,
      body,
      supabase: auth.serviceRole,
    });
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/payment-requests/, "").replace(/^\/payment-requests/, "") || "/";

    if (req.method === "GET" && pathname === "/incoming") {
      const requests = await listIncomingPaymentRequests({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
      });

      return jsonResponse(req, {
        citySlug: cityScope.citySlug,
        requests,
      });
    }

    if (req.method === "GET" && pathname === "/outgoing") {
      const includeClosed = new URL(req.url).searchParams.get("includeClosed") === "true";
      const requests = await listOutgoingPaymentRequests({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
        includeClosed,
      });

      return jsonResponse(req, {
        citySlug: cityScope.citySlug,
        requests,
      });
    }

    if (req.method === "GET" && pathname === "/recent-participants") {
      const participants = await listRecentPaymentRequestParticipants({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
      });

      return jsonResponse(req, {
        citySlug: cityScope.citySlug,
        participants,
      });
    }

    if (req.method === "POST" && pathname === "/create") {
      const request = await createPaymentRequest({
        supabase: auth.serviceRole,
        cityScope,
        requesterId: Number(auth.userRow.id),
        requestFrom:
          typeof body?.requestFrom === "number"
            ? body.requestFrom
            : typeof body?.requestFrom === "string"
              ? Number.parseInt(body.requestFrom, 10)
              : null,
        amountRequested:
          typeof body?.amountRequested === "number"
            ? body.amountRequested
            : typeof body?.amountRequested === "string"
              ? Number.parseFloat(body.amountRequested)
              : null,
      });

      return jsonResponse(req, { request });
    }

    if (req.method === "POST" && pathname === "/mark-paid") {
      const requestId =
        typeof body?.requestId === "number"
          ? body.requestId
          : Number.parseInt(String(body?.requestId ?? ""), 10);
      if (!Number.isFinite(requestId)) {
        throw new Error("requestId is required.");
      }

      const request = await markPaymentRequestPaid({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
        requestId,
        transactionId:
          typeof body?.transactionId === "number"
            ? body.transactionId
            : typeof body?.transactionId === "string"
              ? Number.parseInt(body.transactionId, 10)
              : null,
      });

      return jsonResponse(req, { request });
    }

    if (req.method === "POST" && pathname === "/dismiss") {
      const requestId =
        typeof body?.requestId === "number"
          ? body.requestId
          : Number.parseInt(String(body?.requestId ?? ""), 10);
      if (!Number.isFinite(requestId)) {
        throw new Error("requestId is required.");
      }

      const request = await dismissPaymentRequest({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
        requestId,
      });

      return jsonResponse(req, { request });
    }

    if (req.method === "POST" && pathname === "/cancel") {
      const requestId =
        typeof body?.requestId === "number"
          ? body.requestId
          : Number.parseInt(String(body?.requestId ?? ""), 10);
      if (!Number.isFinite(requestId)) {
        throw new Error("requestId is required.");
      }

      const request = await cancelPaymentRequest({
        supabase: auth.serviceRole,
        cityScope,
        userId: Number(auth.userRow.id),
        requestId,
      });

      return jsonResponse(req, { request });
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payment-requests error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message === "Payment request not found."
            ? 404
            : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
