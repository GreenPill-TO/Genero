import { NextResponse } from "next/server";
import { assertCityManagerAccess, resolveMerchantSignupContext } from "@shared/lib/merchantSignup/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { citySlug?: string; reason?: string };
    const storeId = Number(params.id);

    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "Invalid store id." }, { status: 400 });
    }

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(body.citySlug);

    await assertCityManagerAccess({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const { data: storeRow, error: storeError } = await serviceRole
      .from("stores")
      .select("id,lifecycle_status")
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Failed to validate store for approval: ${storeError.message}`);
    }

    if (!storeRow) {
      return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
    }

    if (storeRow.lifecycle_status !== "pending") {
      return NextResponse.json({ error: "Only pending stores can be approved." }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const { error: approveError } = await serviceRole
      .from("stores")
      .update({
        lifecycle_status: "live",
        approved_at: nowIso,
        approved_by: userRow.id,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      })
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .eq("lifecycle_status", "pending");

    if (approveError) {
      throw new Error(`Failed to approve store application: ${approveError.message}`);
    }

    const { error: profileError } = await serviceRole
      .from("store_profiles")
      .update({ status: "active", updated_at: nowIso })
      .eq("store_id", storeId)
      .eq("app_instance_id", appInstanceId);

    if (profileError) {
      throw new Error(`Failed to activate store profile on approval: ${profileError.message}`);
    }

    const [eventResult, governanceResult] = await Promise.all([
      serviceRole.from("store_signup_events").insert({
        store_id: storeId,
        user_id: userRow.id,
        step: 5,
        event_type: "application_approved",
        payload: {
          citySlug,
          appInstanceId,
          reason: typeof body.reason === "string" ? body.reason.trim() : null,
        },
        created_at: nowIso,
      }),
      serviceRole.from("governance_actions_log").insert({
        action_type: "merchant_application_approved",
        city_slug: citySlug,
        store_id: storeId,
        actor_user_id: userRow.id,
        reason: typeof body.reason === "string" ? body.reason.trim() || "Merchant application approved" : "Merchant application approved",
        payload: {
          appInstanceId,
          approvedAt: nowIso,
        },
      }),
    ]);

    if (eventResult.error) {
      throw new Error(`Failed to log approval signup event: ${eventResult.error.message}`);
    }

    if (governanceResult.error) {
      throw new Error(`Failed to log approval governance action: ${governanceResult.error.message}`);
    }

    return NextResponse.json({
      citySlug,
      appInstanceId,
      storeId,
      status: "live",
      approvedAt: nowIso,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error approving merchant application";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
