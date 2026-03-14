import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, userHasAnyRole } from "@shared/lib/bia/server";
import { projectOnrampStatus, type OnrampCheckoutSessionRow } from "@services/onramp/src";

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const { searchParams } = new URL(req.url);
    const citySlug = resolveCitySlug(searchParams.get("citySlug") ?? undefined);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const sessionId = context.params.id;
    if (!sessionId || sessionId.trim() === "") {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const sessionResult = await serviceRole
      .from("onramp_checkout_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("city_slug", citySlug)
      .eq("app_instance_id", appInstanceId)
      .maybeSingle();

    if (sessionResult.error) {
      throw new Error(`Failed to load onramp checkout session: ${sessionResult.error.message}`);
    }

    if (!sessionResult.data) {
      return NextResponse.json({ error: "Onramp session not found." }, { status: 404 });
    }

    const session = sessionResult.data as OnrampCheckoutSessionRow;
    const isPrivileged = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    if (!isPrivileged && Number(session.user_id) !== Number(userRow.id)) {
      return NextResponse.json({ error: "Forbidden: this session does not belong to current user." }, { status: 403 });
    }

    return NextResponse.json({
      session: projectOnrampStatus(session),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp status error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json().catch(() => ({}))) as { citySlug?: string; action?: string };
    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const sessionId = context.params.id;
    if (!sessionId || sessionId.trim() === "") {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const sessionResult = await serviceRole
      .from("onramp_checkout_sessions")
      .select("id,user_id,status")
      .eq("id", sessionId)
      .eq("city_slug", citySlug)
      .eq("app_instance_id", appInstanceId)
      .maybeSingle();

    if (sessionResult.error) {
      throw new Error(`Failed to load onramp checkout session: ${sessionResult.error.message}`);
    }
    if (!sessionResult.data) {
      return NextResponse.json({ error: "Onramp session not found." }, { status: 404 });
    }

    const isPrivileged = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    if (!isPrivileged && Number(sessionResult.data.user_id) !== Number(userRow.id)) {
      return NextResponse.json({ error: "Forbidden: this session does not belong to current user." }, { status: 403 });
    }

    if (body.action === "widget_opened" && sessionResult.data.status === "created") {
      const { error: updateError } = await serviceRole
        .from("onramp_checkout_sessions")
        .update({
          status: "widget_opened",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (updateError) {
        throw new Error(`Failed to update onramp session action: ${updateError.message}`);
      }
    }

    const refreshedResult = await serviceRole
      .from("onramp_checkout_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (refreshedResult.error || !refreshedResult.data) {
      throw new Error(`Failed to refresh onramp session: ${refreshedResult.error?.message ?? "not found"}`);
    }

    const refreshed = refreshedResult.data as OnrampCheckoutSessionRow;
    return NextResponse.json({ session: projectOnrampStatus(refreshed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp session update error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
