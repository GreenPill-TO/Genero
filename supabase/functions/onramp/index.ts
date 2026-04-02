import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import {
  createOnrampSession,
  createLegacyInteracReference,
  createPoolPurchaseRequest,
  confirmLegacyInteracReference,
  getOnrampSessionStatus,
  ingestTransakWebhook,
  listLegacyRampAdminRequests,
  listOnrampAdminSessions,
  markOnrampSessionAction,
  retryOnrampSession,
  touchOnrampSessionsForUser,
  updateLegacyInteracAdminRequest,
} from "../_shared/onramp.ts";
import { createServiceRoleClient } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/responses.ts";
import { toNumber } from "../_shared/validation.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;
const DenoEnv = (
  globalThis as typeof globalThis & {
    Deno?: { env?: { get(name: string): string | undefined } };
  }
).Deno?.env;

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

function headerValue(req: Request, key: string): string | null {
  return req.headers.get(key) ?? req.headers.get(key.toLowerCase()) ?? req.headers.get(key.toUpperCase());
}

function resolveWebhookForwardSecret(): string {
  const secret = (DenoEnv?.get("ONRAMP_WEBHOOK_FORWARD_SECRET") ?? process.env.ONRAMP_WEBHOOK_FORWARD_SECRET)?.trim();
  if (!secret) {
    throw new Error("ONRAMP_WEBHOOK_FORWARD_SECRET is required for webhook forwarding.");
  }
  return secret;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const rawPathname = new URL(req.url).pathname;
    const pathname = rawPathname.replace(/^\/functions\/v1\/onramp/, "").replace(/^\/onramp/, "") || "/";

    if (req.method === "POST" && pathname === "/webhooks/transak") {
      const forwardedSecret = headerValue(req, "x-onramp-forward-secret");
      if (forwardedSecret !== resolveWebhookForwardSecret()) {
        return jsonResponse(req, { error: "Invalid webhook forwarding secret." }, { status: 401 });
      }

      const body = await readBody(req);
      return jsonResponse(
        req,
        await ingestTransakWebhook({
          supabase: createServiceRoleClient(),
          event: {
            providerEventId: typeof body?.providerEventId === "string" ? body.providerEventId : null,
            providerOrderId: typeof body?.providerOrderId === "string" ? body.providerOrderId : null,
            providerSessionId: typeof body?.providerSessionId === "string" ? body.providerSessionId : null,
            eventType: typeof body?.eventType === "string" ? body.eventType : null,
            statusHint: typeof body?.statusHint === "string" ? body.statusHint : null,
            txHash: typeof body?.txHash === "string" ? body.txHash : null,
            payload:
              body?.payload && typeof body.payload === "object"
                ? (body.payload as Record<string, unknown>)
                : null,
            signatureMode: typeof body?.signatureMode === "string" ? body.signatureMode : "none",
          },
        })
      );
    }

    const body = await readBody(req);
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, body),
    });

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

    if (req.method === "POST" && pathname === "/legacy/interac/reference") {
      return jsonResponse(
        req,
        await createLegacyInteracReference({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          amount: body?.amount ?? 0,
          refCode: typeof body?.refCode === "string" ? body.refCode : "",
        })
      );
    }

    if (req.method === "POST" && pathname === "/legacy/interac/confirm") {
      return jsonResponse(
        req,
        await confirmLegacyInteracReference({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          refCode: typeof body?.refCode === "string" ? body.refCode : "",
        })
      );
    }

    if (req.method === "POST" && pathname === "/pool-purchase-request") {
      return jsonResponse(
        req,
        await createPoolPurchaseRequest({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appInstanceId: appContext.appInstanceId,
          citySlug: appContext.citySlug,
          payload: body ?? {},
        })
      );
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

    if (req.method === "PATCH" && /^\/admin\/requests\/interac\/\d+$/.test(pathname)) {
      return jsonResponse(
        req,
        await updateLegacyInteracAdminRequest({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appInstanceId: appContext.appInstanceId,
          requestId: Number(pathname.split("/")[4]),
          payload: body ?? {},
        })
      );
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
