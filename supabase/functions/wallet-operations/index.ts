import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  connectWalletContact,
  getWalletContactDetail,
  listWalletContactImports,
  getWalletContactTransactionHistory,
  getWalletTransactionHistory,
  listWalletContacts,
  listWalletRecents,
  lookupWalletUserByIdentifier,
  queueWalletContactInviteBatch,
  recordWalletTransfer,
  saveWalletContactImports,
  sendWalletAdminNotification,
  sendWalletSuccessNotification,
  updateWalletContactState,
} from "../_shared/walletOperations.ts";

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
      rawPathname.replace(/^\/functions\/v1\/wallet-operations/, "").replace(/^\/wallet-operations/, "") || "/";

    if (req.method === "GET" && pathname === "/contacts") {
      return jsonResponse(req, await listWalletContacts(base));
    }

    if (req.method === "POST" && pathname === "/contacts/connect") {
      return jsonResponse(
        req,
        await connectWalletContact({
          ...base,
          connectedUserId: Number(body?.connectedUserId ?? 0),
          state: typeof body?.state === "string" ? body.state : undefined,
        })
      );
    }

    if (req.method === "POST" && pathname === "/contacts/state") {
      return jsonResponse(
        req,
        await updateWalletContactState({
          ...base,
          connectedUserId: Number(body?.connectedUserId ?? 0),
          state: typeof body?.state === "string" ? body.state : "",
        })
      );
    }

    if (req.method === "GET" && /^\/contacts\/\d+$/.test(pathname)) {
      return jsonResponse(req, await getWalletContactDetail({ ...base, contactId: Number(pathname.split("/")[2]) }));
    }

    if (req.method === "GET" && pathname === "/contacts/imports") {
      return jsonResponse(req, await listWalletContactImports(base));
    }

    if (req.method === "POST" && pathname === "/contacts/imports") {
      return jsonResponse(
        req,
        await saveWalletContactImports({
          ...base,
          granted: typeof body?.granted === "boolean" ? body.granted : false,
          source: typeof body?.source === "string" ? body.source : undefined,
          contacts: body?.contacts,
        })
      );
    }

    if (req.method === "POST" && pathname === "/contacts/invite-batches") {
      return jsonResponse(
        req,
        await queueWalletContactInviteBatch({
          ...base,
          subject: typeof body?.subject === "string" ? body.subject : "",
          message: typeof body?.message === "string" ? body.message : "",
          recipients: body?.recipients,
        })
      );
    }

    if (req.method === "GET" && pathname === "/recents") {
      return jsonResponse(req, await listWalletRecents(base));
    }

    if (req.method === "GET" && pathname === "/transactions/history") {
      return jsonResponse(req, await getWalletTransactionHistory(base));
    }

    if (req.method === "GET" && /^\/transactions\/contact\/\d+$/.test(pathname)) {
      return jsonResponse(
        req,
        await getWalletContactTransactionHistory({
          ...base,
          contactId: Number(pathname.split("/")[3]),
        })
      );
    }

    if (req.method === "POST" && pathname === "/lookup/user-by-identifier") {
      return jsonResponse(
        req,
        await lookupWalletUserByIdentifier({
          ...base,
          userIdentifier: typeof body?.userIdentifier === "string" ? body.userIdentifier : "",
        })
      );
    }

    if (req.method === "POST" && pathname === "/transfers/record") {
      return jsonResponse(
        req,
        await recordWalletTransfer({
          ...base,
          recipient_wallet: typeof body?.recipient_wallet === "string" ? body.recipient_wallet : "",
          sender_wallet: typeof body?.sender_wallet === "string" ? body.sender_wallet : "",
          token_price: typeof body?.token_price === "number" ? body.token_price : undefined,
          transfer_amount: Number(body?.transfer_amount ?? 0),
          transfer_user_id: Number(body?.transfer_user_id ?? 0),
        })
      );
    }

    if (req.method === "POST" && pathname === "/notifications/success") {
      return jsonResponse(
        req,
        await sendWalletSuccessNotification({
          ...base,
          userIdOverride:
            typeof body?.user_id === "string" || typeof body?.user_id === "number" ? body.user_id : "",
          notification: typeof body?.notification === "string" ? body.notification : "",
          additionalData:
            body?.additionalData && typeof body.additionalData === "object"
              ? (body.additionalData as Record<string, unknown>)
              : undefined,
        })
      );
    }

    if (req.method === "POST" && pathname === "/notifications/admin") {
      return jsonResponse(
        req,
        await sendWalletAdminNotification({
          ...base,
          userIdOverride: typeof body?.user_id === "string" ? body.user_id : "",
          notification: typeof body?.notification === "string" ? body.notification : "",
        })
      );
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected wallet-operations error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
