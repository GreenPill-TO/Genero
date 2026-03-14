import { NextResponse } from "next/server";
import { assertDraftStoreAdminAccess } from "@shared/lib/merchantSignup/application";
import { resolveMerchantSignupContext } from "@shared/lib/merchantSignup/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      citySlug?: string;
      storeId?: number | string;
    };

    const storeId = Number(body.storeId ?? 0);
    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "storeId must be a positive number." }, { status: 400 });
    }

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(body.citySlug);
    const userId = Number(userRow.id);

    const access = await assertDraftStoreAdminAccess({
      supabase: serviceRole,
      userId,
      appInstanceId,
      storeId,
    });

    if (access.lifecycleStatus !== "draft") {
      return NextResponse.json({ error: "Only draft applications can be submitted." }, { status: 409 });
    }

    const [{ data: profile, error: profileError }, { data: biaAffiliation, error: biaError }] = await Promise.all([
      serviceRole
        .from("store_profiles")
        .select("display_name,description,logo_url,banner_url,address_text,lat,lng,slug")
        .eq("store_id", storeId)
        .eq("app_instance_id", appInstanceId)
        .limit(1)
        .maybeSingle(),
      serviceRole
        .from("store_bia_affiliations")
        .select("id,bia_id")
        .eq("store_id", storeId)
        .is("effective_to", null)
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError) {
      throw new Error(`Failed to validate store profile before submission: ${profileError.message}`);
    }

    if (biaError) {
      throw new Error(`Failed to validate store BIA before submission: ${biaError.message}`);
    }

    const missingFields: string[] = [];
    if (!profile?.display_name) missingFields.push("displayName");
    if (!profile?.description) missingFields.push("description");
    if (!profile?.logo_url) missingFields.push("logoUrl");
    if (!profile?.banner_url) missingFields.push("bannerUrl");
    if (!profile?.address_text) missingFields.push("addressText");
    if (!(typeof profile?.lat === "number" && Number.isFinite(profile.lat))) missingFields.push("lat");
    if (!(typeof profile?.lng === "number" && Number.isFinite(profile.lng))) missingFields.push("lng");
    if (!profile?.slug) missingFields.push("slug");
    if (!biaAffiliation?.bia_id) missingFields.push("biaId");

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Application is incomplete. Complete all required steps before submission.",
          missingFields,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error: submitError } = await serviceRole
      .from("stores")
      .update({
        lifecycle_status: "pending",
        submitted_at: nowIso,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
        signup_step: 5,
        signup_progress_count: 5,
      })
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .eq("lifecycle_status", "draft");

    if (submitError) {
      throw new Error(`Failed to submit merchant application: ${submitError.message}`);
    }

    const { error: profileStatusError } = await serviceRole
      .from("store_profiles")
      .update({ status: "inactive", updated_at: nowIso })
      .eq("store_id", storeId)
      .eq("app_instance_id", appInstanceId);

    if (profileStatusError) {
      throw new Error(`Failed to update store profile status after submission: ${profileStatusError.message}`);
    }

    const { error: eventError } = await serviceRole.from("store_signup_events").insert({
      store_id: storeId,
      user_id: userId,
      step: 5,
      event_type: "application_submitted",
      payload: {
        citySlug,
        appInstanceId,
        biaId: biaAffiliation?.bia_id ?? null,
      },
      created_at: nowIso,
    });

    if (eventError) {
      throw new Error(`Failed to log application submission event: ${eventError.message}`);
    }

    return NextResponse.json({
      citySlug,
      storeId,
      status: "pending",
      submittedAt: nowIso,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error submitting merchant application";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
