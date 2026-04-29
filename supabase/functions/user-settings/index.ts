import {
  createServiceRoleClient,
  resolveAuthenticatedEdgeContext,
  resolveAuthenticatedSupabaseUser,
} from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  clearPendingPaymentIntent,
  completeSignup,
  ensureAuthenticatedUserRecord,
  getLegacyCubidData,
  getWalletCustodyMaterial,
  getUserSettingsBootstrap,
  listPersonas,
  registerWalletCustody,
  resetSignup,
  savePendingPaymentIntent,
  saveSignupStep,
  startSignup,
  updateLegacyCubidData,
  updateUserPreferences,
  updateUserProfile,
} from "../_shared/userSettings.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

async function readRequestBody(req: Request) {
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
    const body = await readRequestBody(req);
    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname
        .replace(/^\/functions\/v1\/user-settings/, "")
        .replace(/^\/user-settings/, "") || "/";

    if (req.method === "POST" && pathname === "/auth/ensure-user") {
      const { serviceRole, authUser } = await resolveAuthenticatedSupabaseUser(req, "user-settings ensure-user");

      const appContext = await resolveActiveAppContext({
        supabase: serviceRole,
        input: resolveAppContextInput(req, body),
      });

      return jsonResponse(
        req,
        await ensureAuthenticatedUserRecord({
          supabase: serviceRole,
          authUser,
          appContext,
          authMethod: typeof body?.authMethod === "string" ? body.authMethod : null,
          fullContact: typeof body?.fullContact === "string" ? body.fullContact : null,
          cubidId: typeof body?.cubidId === "string" ? body.cubidId : null,
        })
      );
    }

    const scoped = await resolveAuthenticatedEdgeContext(req, {
      purpose: "user-settings scoped identity and app context",
      input: resolveAppContextInput(req, body),
    });
    const serviceRole = createServiceRoleClient({ purpose: `user-settings ${pathname} operation` });

    if (req.method === "GET" && pathname === "/bootstrap") {
      return jsonResponse(
        req,
        await getUserSettingsBootstrap({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "PATCH" && pathname === "/profile") {
      return jsonResponse(
        req,
        await updateUserProfile({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "PATCH" && pathname === "/preferences") {
      return jsonResponse(
        req,
        await updateUserPreferences({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "GET" && pathname === "/personas") {
      return jsonResponse(
        req,
        await listPersonas({
          supabase: serviceRole,
        })
      );
    }

    if (req.method === "POST" && pathname === "/wallet/register-custody") {
      return jsonResponse(
        req,
        await registerWalletCustody({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "GET" && pathname === "/wallet/custody-material") {
      return jsonResponse(
        req,
        await getWalletCustodyMaterial({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "GET" && pathname === "/legacy/cubid-data") {
      return jsonResponse(
        req,
        await getLegacyCubidData({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "PATCH" && pathname === "/legacy/cubid-data") {
      return jsonResponse(
        req,
        await updateLegacyCubidData({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/start") {
      return jsonResponse(
        req,
        await startSignup({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/step") {
      return jsonResponse(
        req,
        await saveSignupStep({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/reset") {
      return jsonResponse(
        req,
        await resetSignup({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/complete") {
      return jsonResponse(
        req,
        await completeSignup({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/pending-payment-intent") {
      return jsonResponse(
        req,
        await savePendingPaymentIntent({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/pending-payment-intent/clear") {
      return jsonResponse(
        req,
        await clearPendingPaymentIntent({
          supabase: serviceRole,
          userId: Number(scoped.userRow.id),
          appContext: scoped.appContext,
        })
      );
    }

    return jsonResponse(req, { error: "Not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected user-settings error";
    const status = message === "Unauthorized" ? 401 : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
