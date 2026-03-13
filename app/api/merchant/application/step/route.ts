import { NextResponse } from "next/server";
import { assertDraftStoreAdminAccess } from "@shared/lib/merchantSignup/application";
import {
  assertValidStoreSlug,
  normaliseStoreSlug,
  resolveMerchantSignupContext,
} from "@shared/lib/merchantSignup/server";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      citySlug?: string;
      storeId?: number | string;
      step?: number | string;
      payload?: Record<string, unknown>;
    };

    const storeId = Number(body.storeId ?? 0);
    const step = Number(body.step ?? 0);

    if (!Number.isFinite(storeId) || storeId <= 0) {
      return NextResponse.json({ error: "storeId must be a positive number." }, { status: 400 });
    }

    if (!Number.isFinite(step) || step < 1 || step > 5) {
      return NextResponse.json({ error: "step must be between 1 and 5." }, { status: 400 });
    }

    const payload = body.payload ?? {};

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(body.citySlug);
    const userId = Number(userRow.id);

    const access = await assertDraftStoreAdminAccess({
      supabase: serviceRole,
      userId,
      appInstanceId,
      storeId,
    });

    if (access.lifecycleStatus !== "draft") {
      return NextResponse.json({ error: "Only draft applications can be edited." }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    if (step === 1) {
      const consentAccepted = payload.consentAccepted === true;
      if (!consentAccepted) {
        return NextResponse.json({ error: "You must accept the merchant terms to continue." }, { status: 400 });
      }
    }

    if (step === 2) {
      const displayName = String(payload.displayName ?? "").trim();
      const description = String(payload.description ?? "").trim();
      const logoUrl = String(payload.logoUrl ?? "").trim();
      const bannerUrl = String(payload.bannerUrl ?? "").trim();

      if (!displayName) {
        return NextResponse.json({ error: "Store name is required." }, { status: 400 });
      }

      const { error: profileError } = await serviceRole
        .from("store_profiles")
        .upsert(
          {
            store_id: storeId,
            app_instance_id: appInstanceId,
            display_name: displayName,
            description: description || null,
            logo_url: logoUrl || null,
            banner_url: bannerUrl || null,
            updated_at: nowIso,
          },
          { onConflict: "store_id" }
        );

      if (profileError) {
        throw new Error(`Failed to save store profile step: ${profileError.message}`);
      }
    }

    if (step === 3) {
      const addressText = String(payload.addressText ?? "").trim();
      const lat = asNumber(payload.lat);
      const lng = asNumber(payload.lng);

      if (!addressText || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: "Address, latitude, and longitude are required." }, { status: 400 });
      }

      const { error: profileError } = await serviceRole
        .from("store_profiles")
        .upsert(
          {
            store_id: storeId,
            app_instance_id: appInstanceId,
            address_text: addressText,
            lat,
            lng,
            updated_at: nowIso,
          },
          { onConflict: "store_id" }
        );

      if (profileError) {
        throw new Error(`Failed to save store address step: ${profileError.message}`);
      }
    }

    if (step === 4) {
      const biaId = String(payload.biaId ?? "").trim();
      if (!biaId) {
        return NextResponse.json({ error: "biaId is required." }, { status: 400 });
      }

      const { data: biaRow, error: biaError } = await serviceRole
        .from("bia_registry")
        .select("id")
        .eq("id", biaId)
        .eq("city_slug", citySlug)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (biaError) {
        throw new Error(`Failed to validate selected BIA: ${biaError.message}`);
      }

      if (!biaRow) {
        return NextResponse.json({ error: "Selected BIA is not active for this city." }, { status: 400 });
      }

      const { error: closeError } = await serviceRole
        .from("store_bia_affiliations")
        .update({ effective_to: nowIso, updated_at: nowIso })
        .eq("store_id", storeId)
        .is("effective_to", null);

      if (closeError) {
        throw new Error(`Failed to close previous BIA affiliation: ${closeError.message}`);
      }

      const { error: insertError } = await serviceRole.from("store_bia_affiliations").insert({
        store_id: storeId,
        bia_id: biaId,
        source: "merchant_selected",
        effective_from: nowIso,
        effective_to: null,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (insertError) {
        throw new Error(`Failed to save BIA step: ${insertError.message}`);
      }
    }

    if (step === 5) {
      const slug = assertValidStoreSlug(String(payload.slug ?? ""));
      const normalizedSlug = normaliseStoreSlug(slug);

      const { data: existingSlugRows, error: existingSlugError } = await serviceRole
        .from("store_profiles")
        .select("store_id")
        .eq("app_instance_id", appInstanceId)
        .ilike("slug", normalizedSlug)
        .neq("store_id", storeId)
        .limit(1);

      if (existingSlugError) {
        throw new Error(`Failed to validate slug availability: ${existingSlugError.message}`);
      }

      if (Array.isArray(existingSlugRows) && existingSlugRows.length > 0) {
        return NextResponse.json({ error: "Store slug is already in use." }, { status: 409 });
      }

      const { error: slugError } = await serviceRole
        .from("store_profiles")
        .upsert(
          {
            store_id: storeId,
            app_instance_id: appInstanceId,
            slug: normalizedSlug,
            updated_at: nowIso,
          },
          { onConflict: "store_id" }
        );

      if (slugError) {
        throw new Error(`Failed to save slug step: ${slugError.message}`);
      }
    }

    const { data: storeRow, error: storeError } = await serviceRole
      .from("stores")
      .select("signup_step,signup_progress_count")
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Failed to reload application progress: ${storeError.message}`);
    }

    const currentStep = Number(storeRow?.signup_step ?? 1);
    const currentProgress = Number(storeRow?.signup_progress_count ?? 0);
    const nextStep = Math.max(currentStep, step);

    const { error: progressError } = await serviceRole
      .from("stores")
      .update({
        signup_step: nextStep,
        signup_progress_count: Number.isFinite(currentProgress) ? currentProgress + 1 : 1,
      })
      .eq("id", storeId)
      .eq("app_instance_id", appInstanceId)
      .eq("lifecycle_status", "draft");

    if (progressError) {
      throw new Error(`Failed to update signup progress: ${progressError.message}`);
    }

    const { error: eventError } = await serviceRole.from("store_signup_events").insert({
      store_id: storeId,
      user_id: userId,
      step,
      event_type: "step_saved",
      payload,
      created_at: nowIso,
    });

    if (eventError) {
      throw new Error(`Failed to log signup step event: ${eventError.message}`);
    }

    return NextResponse.json({
      citySlug,
      storeId,
      step,
      signupStep: nextStep,
      nextStep: Math.min(5, step + 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error saving merchant application step";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("Only draft") || message.includes("slug")
            ? 409
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
