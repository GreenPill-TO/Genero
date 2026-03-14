import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { resolveCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";
import {
  completeSignup,
  getUserSettingsBootstrap,
  resetSignup,
  saveSignupStep,
  startSignup,
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
    const auth = await resolveAuthenticatedUser(req);
    const appContext = await resolveActiveAppContext({
      supabase: auth.serviceRole,
      input: resolveAppContextInput(req, body),
    });

    const rawPathname = new URL(req.url).pathname;
    const pathname =
      rawPathname
        .replace(/^\/functions\/v1\/user-settings/, "")
        .replace(/^\/user-settings/, "") || "/";

    if (req.method === "GET" && pathname === "/bootstrap") {
      return jsonResponse(
        req,
        await getUserSettingsBootstrap({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
        })
      );
    }

    if (req.method === "PATCH" && pathname === "/profile") {
      return jsonResponse(
        req,
        await updateUserProfile({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "PATCH" && pathname === "/preferences") {
      return jsonResponse(
        req,
        await updateUserPreferences({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/start") {
      return jsonResponse(
        req,
        await startSignup({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/step") {
      return jsonResponse(
        req,
        await saveSignupStep({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
          payload: body ?? {},
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/reset") {
      return jsonResponse(
        req,
        await resetSignup({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
        })
      );
    }

    if (req.method === "POST" && pathname === "/signup/complete") {
      return jsonResponse(
        req,
        await completeSignup({
          supabase: auth.serviceRole,
          userId: Number(auth.userRow.id),
          appContext,
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
