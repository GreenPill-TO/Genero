import { createServiceRoleClient, resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  consumePaymentRequestLink,
  createPaymentRequestLink,
  resolvePaymentRequestLink,
} from "../_shared/paymentRequestLinks.ts";

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
    return new Response("ok", { headers: resolveCorsHeaders(req) });
  }

  try {
    const body = await readBody(req);
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/payment-links/, "").replace(/^\/payment-links/, "") || "/";

    if (req.method === "GET" && pathname.startsWith("/resolve/")) {
      const token = decodeURIComponent(pathname.replace(/^\/resolve\//, "")).trim();
      if (!token) {
        return jsonResponse(
          req,
          {
            link: {
              token: "",
              state: "invalid",
              mode: null,
              amountRequested: null,
              expiresAt: null,
              consumedAt: null,
              url: null,
              recipient: null,
            },
          },
          { status: 200 }
        );
      }

      return jsonResponse(
        req,
        await resolvePaymentRequestLink({
          supabase: createServiceRoleClient(),
          token,
        })
      );
    }

    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, body),
    });

    if (req.method === "POST" && pathname === "/create") {
      return jsonResponse(
        req,
        await createPaymentRequestLink({
          supabase: auth.serviceRole,
          appContext,
          recipientUserId: Number(auth.userRow.id),
          amountRequested: body?.amountRequested,
          mode: body?.mode,
        })
      );
    }

    if (req.method === "POST" && pathname === "/consume") {
      const token = typeof body?.token === "string" ? body.token.trim() : "";
      if (!token) {
        throw new Error("token is required.");
      }

      return jsonResponse(
        req,
        await consumePaymentRequestLink({
          supabase: auth.serviceRole,
          token,
          consumingUserId: Number(auth.userRow.id),
          transactionId: body?.transactionId,
        })
      );
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payment-links error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
