import { createServiceRoleClient, resolveAuthenticatedEdgeContext } from "../_shared/auth.ts";
import { resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  createVoucherPaymentRecordRuntime,
  getVoucherPortfolioRuntime,
  getVoucherRouteRuntime,
} from "../_shared/voucherRuntime.ts";

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
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const body = await readBody(req);
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/voucher-runtime/, "").replace(/^\/voucher-runtime/, "") || "/";
    const scoped = await resolveAuthenticatedEdgeContext(req, {
      purpose: "voucher runtime scoped identity and app context",
      input: resolveAppContextInput(req, body),
    });
    const serviceRole = createServiceRoleClient({ purpose: `voucher runtime ${pathname} operation` });
    const url = new URL(req.url);

    if (req.method === "GET" && pathname === "/portfolio") {
      return jsonResponse(
        req,
        await getVoucherPortfolioRuntime({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          citySlug: scoped.appContext.citySlug,
          appInstanceId: scoped.appContext.appInstanceId,
          chainId: Number(url.searchParams.get("chainId") ?? 0),
          wallet: url.searchParams.get("wallet"),
        })
      );
    }

    if (req.method === "GET" && pathname === "/route") {
      return jsonResponse(
        req,
        await getVoucherRouteRuntime({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          citySlug: scoped.appContext.citySlug,
          appInstanceId: scoped.appContext.appInstanceId,
          chainId: Number(url.searchParams.get("chainId") ?? 0),
          amount: Number(url.searchParams.get("amount") ?? 0),
          recipientWallet: url.searchParams.get("recipientWallet"),
          recipientUserId: Number(url.searchParams.get("recipientUserId") ?? 0),
        })
      );
    }

    if (req.method === "POST" && pathname === "/payment-record") {
      return jsonResponse(
        req,
        await createVoucherPaymentRecordRuntime({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          citySlug: scoped.appContext.citySlug,
          chainId: Number(body?.chainId ?? 0),
          payload: body ?? {},
        })
      );
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher-runtime error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
