import { NextResponse } from "next/server";
import { assertCityManagerAccess, resolveMerchantSignupContext } from "@shared/lib/merchantSignup/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { citySlug?: string; reason?: string };
    const storeId = Number(params.id);

    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "Invalid store id." }, { status: 400 });
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });
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
      throw new Error(`Failed to validate store for rejection: ${storeError.message}`);
    }

    if (!storeRow) {
      return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
    }

    if (storeRow.lifecycle_status !== "pending") {
      return NextResponse.json({ error: "Only pending stores can be rejected." }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const { error: rejectError } = await serviceRole
      .from("stores")
      .update({
        lifecycle_status: "rejected",
        rejected_at: nowIso,
        rejected_by: userRow.id,
        rejection_reason: reason,
      })
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .eq("lifecycle_status", "pending");

    if (rejectError) {
      throw new Error(`Failed to reject store application: ${rejectError.message}`);
    }

    const { error: profileError } = await serviceRole
      .from("store_profiles")
      .update({ status: "inactive", updated_at: nowIso })
      .eq("store_id", storeId)
      .eq("app_instance_id", appInstanceId);

    if (profileError) {
      throw new Error(`Failed to set store profile inactive after rejection: ${profileError.message}`);
    }

    const [eventResult, governanceResult] = await Promise.all([
      serviceRole.from("store_signup_events").insert({
        store_id: storeId,
        user_id: userRow.id,
        step: 5,
        event_type: "application_rejected",
        payload: {
          citySlug,
          appInstanceId,
          reason,
        },
        created_at: nowIso,
      }),
      serviceRole.from("governance_actions_log").insert({
        action_type: "merchant_application_rejected",
        city_slug: citySlug,
        store_id: storeId,
        actor_user_id: userRow.id,
        reason,
        payload: {
          appInstanceId,
          rejectedAt: nowIso,
        },
      }),
    ]);

    if (eventResult.error) {
      throw new Error(`Failed to log rejection signup event: ${eventResult.error.message}`);
    }

    if (governanceResult.error) {
      throw new Error(`Failed to log rejection governance action: ${governanceResult.error.message}`);
    }

    return NextResponse.json({
      citySlug,
      appInstanceId,
      storeId,
      status: "rejected",
      rejectedAt: nowIso,
      reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error rejecting merchant application";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
