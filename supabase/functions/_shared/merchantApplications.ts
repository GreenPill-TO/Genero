import { assertAdminOrOperator, assertStoreAdminAccess } from "./rbac.ts";
import { toNumber } from "./validation.ts";

const LIFECYCLE_PRIORITY = ["draft", "pending", "live", "rejected"] as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type MerchantContext = {
  supabase: any;
  userId: number;
  appContext: {
    citySlug: string;
    appInstanceId: number;
  };
};

function asLifecycleStatus(value: unknown): "draft" | "pending" | "live" | "rejected" {
  if (value === "draft" || value === "pending" || value === "live" || value === "rejected") {
    return value;
  }
  return "draft";
}

function statusRank(status: "draft" | "pending" | "live" | "rejected"): number {
  const index = LIFECYCLE_PRIORITY.indexOf(status);
  return index === -1 ? 999 : index;
}

function recencyValue(row: Record<string, unknown>): number {
  const candidates = [row.submitted_at, row.approved_at, row.rejected_at, row.signup_started_at, row.created_at];
  for (const value of candidates) {
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

export function normaliseStoreSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function assertValidStoreSlug(value: string): string {
  const slug = normaliseStoreSlug(value);
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Store slug must use lowercase letters, numbers, and single hyphens.");
  }
  return slug;
}

export async function checkSlugAvailability(options: MerchantContext & { slug: string; excludeStoreId?: number | null }) {
  const slug = assertValidStoreSlug(options.slug);

  let query = options.supabase
    .from("store_profiles")
    .select("store_id,slug")
    .eq("app_instance_id", options.appContext.appInstanceId)
    .ilike("slug", normaliseStoreSlug(slug))
    .limit(5);

  if (typeof options.excludeStoreId === "number" && options.excludeStoreId > 0) {
    query = query.neq("store_id", options.excludeStoreId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check slug availability: ${error.message}`);
  }

  const available = !Array.isArray(data) || data.length === 0;

  return {
    citySlug: options.appContext.citySlug,
    appInstanceId: options.appContext.appInstanceId,
    slug,
    available,
    reason: available ? null : "Slug is already taken in this city app scope.",
  };
}

export async function resolveUserMerchantApplication(options: MerchantContext) {
  const { data: employeeRows, error: employeeError } = await options.supabase
    .from("store_employees")
    .select("store_id,is_admin")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (employeeError) {
    throw new Error(`Failed to resolve merchant applications: ${employeeError.message}`);
  }

  const storeIds = (employeeRows ?? [])
    .map((row: any) => Number(row.store_id))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  if (storeIds.length === 0) {
    return null;
  }

  const { data: stores, error: storesError } = await options.supabase
    .from("stores")
    .select(
      "id,app_instance_id,lifecycle_status,signup_step,signup_progress_count,submitted_at,approved_at,rejected_at,rejection_reason,created_at,signup_started_at"
    )
    .eq("app_instance_id", options.appContext.appInstanceId)
    .in("id", storeIds);

  if (storesError) {
    throw new Error(`Failed to resolve merchant stores: ${storesError.message}`);
  }

  if (!stores || stores.length === 0) {
    return null;
  }

  const selected = [...stores]
    .sort((a: any, b: any) => {
      const rankDiff = statusRank(asLifecycleStatus(a.lifecycle_status)) - statusRank(asLifecycleStatus(b.lifecycle_status));
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return recencyValue(b) - recencyValue(a);
    })
    .at(0);

  if (!selected) {
    return null;
  }

  const storeId = Number(selected.id);
  const [{ data: profile, error: profileError }, { data: biaAffiliation, error: biaError }] = await Promise.all([
    options.supabase
      .from("store_profiles")
      .select("store_id,app_instance_id,display_name,description,logo_url,banner_url,address_text,lat,lng,slug")
      .eq("store_id", storeId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("store_bia_affiliations")
      .select("bia_id,bia_registry!inner(id,code,name)")
      .eq("store_id", storeId)
      .is("effective_to", null)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`Failed to resolve merchant store profile: ${profileError.message}`);
  }
  if (biaError) {
    throw new Error(`Failed to resolve merchant store BIA: ${biaError.message}`);
  }

  const rawBia = Array.isArray((biaAffiliation as any)?.bia_registry)
    ? (biaAffiliation as any).bia_registry[0]
    : (biaAffiliation as any)?.bia_registry;

  return {
    storeId,
    appInstanceId: Number(selected.app_instance_id ?? options.appContext.appInstanceId),
    lifecycleStatus: asLifecycleStatus(selected.lifecycle_status),
    signupStep: Math.max(1, Math.min(5, Math.trunc(toNumber(selected.signup_step, 1)))),
    signupProgressCount: Math.max(0, Math.trunc(toNumber(selected.signup_progress_count, 0))),
    statusMeta: {
      submittedAt: typeof selected.submitted_at === "string" ? selected.submitted_at : null,
      approvedAt: typeof selected.approved_at === "string" ? selected.approved_at : null,
      rejectedAt: typeof selected.rejected_at === "string" ? selected.rejected_at : null,
      rejectionReason: typeof selected.rejection_reason === "string" ? selected.rejection_reason : null,
    },
    profile: {
      displayName: typeof profile?.display_name === "string" ? profile.display_name : null,
      description: typeof profile?.description === "string" ? profile.description : null,
      logoUrl: typeof profile?.logo_url === "string" ? profile.logo_url : null,
      bannerUrl: typeof profile?.banner_url === "string" ? profile.banner_url : null,
      addressText: typeof profile?.address_text === "string" ? profile.address_text : null,
      lat: typeof profile?.lat === "number" ? profile.lat : null,
      lng: typeof profile?.lng === "number" ? profile.lng : null,
      slug: typeof profile?.slug === "string" ? profile.slug : null,
    },
    bia:
      rawBia && typeof rawBia.id === "string"
        ? {
            id: rawBia.id,
            code: typeof rawBia.code === "string" ? rawBia.code : "BIA",
            name: typeof rawBia.name === "string" ? rawBia.name : rawBia.id,
          }
        : null,
  };
}

export async function listUserDraftStoreIds(options: MerchantContext): Promise<number[]> {
  const { data: employeeRows, error: employeeError } = await options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (employeeError) {
    throw new Error(`Failed to resolve draft store ownership: ${employeeError.message}`);
  }

  const storeIds = (employeeRows ?? [])
    .map((row: any) => Number(row.store_id))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  if (storeIds.length === 0) {
    return [];
  }

  const { data: draftRows, error: draftError } = await options.supabase
    .from("stores")
    .select("id")
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", "draft")
    .in("id", storeIds);

  if (draftError) {
    throw new Error(`Failed to resolve draft stores: ${draftError.message}`);
  }

  return (draftRows ?? [])
    .map((row: any) => Number(row.id))
    .filter((value: number) => Number.isFinite(value) && value > 0);
}

export async function clearDraftStores(options: {
  supabase: any;
  draftStoreIds: number[];
}) {
  if (options.draftStoreIds.length === 0) {
    return;
  }

  const storeIds = options.draftStoreIds;
  const tableDeletes = [
    ["store_signup_events", "store_id"],
    ["store_bia_affiliations", "store_id"],
    ["store_profiles", "store_id"],
    ["store_employees", "store_id"],
  ] as const;

  for (const [table, column] of tableDeletes) {
    const { error } = await options.supabase.from(table).delete().in(column, storeIds);
    if (error) {
      throw new Error(`Failed to clear draft data from ${table}: ${error.message}`);
    }
  }

  const { error: storesDeleteError } = await options.supabase
    .from("stores")
    .delete()
    .in("id", storeIds)
    .eq("lifecycle_status", "draft");

  if (storesDeleteError) {
    throw new Error(`Failed to clear draft stores: ${storesDeleteError.message}`);
  }
}

export async function createDraftStore(options: MerchantContext) {
  const nowIso = new Date().toISOString();

  const { data: createdStore, error: createStoreError } = await options.supabase
    .from("stores")
    .insert({
      app_instance_id: options.appContext.appInstanceId,
      lifecycle_status: "draft",
      signup_step: 1,
      signup_progress_count: 0,
      signup_started_at: nowIso,
      created_at: nowIso,
    })
    .select("id")
    .single();

  if (createStoreError) {
    throw new Error(`Failed to create draft store: ${createStoreError.message}`);
  }

  const storeId = Number(createdStore.id);

  const { error: employeeError } = await options.supabase.from("store_employees").insert({
    store_id: storeId,
    user_id: options.userId,
    app_instance_id: options.appContext.appInstanceId,
    is_admin: true,
    created_at: nowIso,
  });

  if (employeeError) {
    throw new Error(`Failed to create initial store admin employee: ${employeeError.message}`);
  }

  const { error: profileError } = await options.supabase.from("store_profiles").upsert(
    {
      store_id: storeId,
      app_instance_id: options.appContext.appInstanceId,
      status: "inactive",
      created_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "store_id" }
  );

  if (profileError) {
    throw new Error(`Failed to initialize draft store profile: ${profileError.message}`);
  }

  const { error: eventError } = await options.supabase.from("store_signup_events").insert({
    store_id: storeId,
    user_id: options.userId,
    step: 1,
    event_type: "application_started",
    payload: {
      citySlug: options.appContext.citySlug,
      appInstanceId: options.appContext.appInstanceId,
    },
    created_at: nowIso,
  });

  if (eventError) {
    throw new Error(`Failed to log application start event: ${eventError.message}`);
  }

  return { storeId, nowIso };
}

export async function assertDraftStoreAdminAccess(options: MerchantContext & { storeId: number }) {
  await assertStoreAdminAccess({
    supabase: options.supabase,
    userId: options.userId,
    storeId: options.storeId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("id,lifecycle_status")
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (storeError) {
    throw new Error(`Failed to resolve draft store: ${storeError.message}`);
  }
  if (!storeRow) {
    throw new Error("Store not found in this app instance.");
  }

  return {
    storeId: Number(storeRow.id),
    lifecycleStatus: String(storeRow.lifecycle_status ?? "draft"),
  };
}

export async function getMerchantStatus(options: MerchantContext) {
  const application = await resolveUserMerchantApplication(options);
  if (!application) {
    return {
      citySlug: options.appContext.citySlug,
      state: "none",
      storeId: null,
      signupStep: null,
      statusMeta: null,
      application: null,
    };
  }

  return {
    citySlug: options.appContext.citySlug,
    state: application.lifecycleStatus,
    storeId: application.storeId,
    signupStep: application.signupStep,
    statusMeta: application.statusMeta,
    application,
  };
}

export async function startMerchantApplication(options: MerchantContext & { forceNew?: boolean }) {
  const existing = await resolveUserMerchantApplication(options);

  if (existing && (existing.lifecycleStatus === "pending" || existing.lifecycleStatus === "live")) {
    throw new Error("Cannot start a new application while current merchant status is pending/live.");
  }

  if (existing && existing.lifecycleStatus === "draft" && !options.forceNew) {
    return {
      citySlug: options.appContext.citySlug,
      storeId: existing.storeId,
      signupStep: existing.signupStep,
      state: "draft",
    };
  }

  if (options.forceNew) {
    const draftIds = await listUserDraftStoreIds(options);
    await clearDraftStores({
      supabase: options.supabase,
      draftStoreIds: draftIds,
    });
  }

  const created = await createDraftStore(options);
  return {
    citySlug: options.appContext.citySlug,
    storeId: created.storeId,
    signupStep: 1,
    state: "draft",
  };
}

export async function restartMerchantApplication(options: MerchantContext) {
  const existing = await resolveUserMerchantApplication(options);
  if (existing && (existing.lifecycleStatus === "pending" || existing.lifecycleStatus === "live")) {
    throw new Error("Cannot restart while the current merchant application is pending or live.");
  }

  const draftIds = await listUserDraftStoreIds(options);
  await clearDraftStores({
    supabase: options.supabase,
    draftStoreIds: draftIds,
  });

  const created = await createDraftStore(options);
  return {
    citySlug: options.appContext.citySlug,
    storeId: created.storeId,
    signupStep: 1,
    state: "draft",
  };
}

export async function saveMerchantApplicationStep(
  options: MerchantContext & {
    storeId: number;
    step: number;
    payload: Record<string, unknown>;
  }
) {
  const access = await assertDraftStoreAdminAccess(options);
  if (access.lifecycleStatus !== "draft") {
    throw new Error("Only draft applications can be edited.");
  }

  const { storeId, step, payload } = options;
  const nowIso = new Date().toISOString();

  if (step === 1 && payload.consentAccepted !== true) {
    throw new Error("You must accept the merchant terms to continue.");
  }

  if (step === 2) {
    const displayName = String(payload.displayName ?? "").trim();
    const description = String(payload.description ?? "").trim();
    const logoUrl = String(payload.logoUrl ?? "").trim();
    const bannerUrl = String(payload.bannerUrl ?? "").trim();

    if (!displayName) {
      throw new Error("Store name is required.");
    }

    const { error } = await options.supabase
      .from("store_profiles")
      .upsert(
        {
          store_id: storeId,
          app_instance_id: options.appContext.appInstanceId,
          display_name: displayName,
          description: description || null,
          logo_url: logoUrl || null,
          banner_url: bannerUrl || null,
          updated_at: nowIso,
        },
        { onConflict: "store_id" }
      );

    if (error) {
      throw new Error(`Failed to save store profile step: ${error.message}`);
    }
  }

  if (step === 3) {
    const addressText = String(payload.addressText ?? "").trim();
    const lat = toNumber(payload.lat, Number.NaN);
    const lng = toNumber(payload.lng, Number.NaN);

    if (!addressText || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Address, latitude, and longitude are required.");
    }

    const { error } = await options.supabase
      .from("store_profiles")
      .upsert(
        {
          store_id: storeId,
          app_instance_id: options.appContext.appInstanceId,
          address_text: addressText,
          lat,
          lng,
          updated_at: nowIso,
        },
        { onConflict: "store_id" }
      );

    if (error) {
      throw new Error(`Failed to save store address step: ${error.message}`);
    }
  }

  if (step === 4) {
    const biaId = String(payload.biaId ?? "").trim();
    if (!biaId) {
      throw new Error("biaId is required.");
    }

    const { data: biaRow, error: biaError } = await options.supabase
      .from("bia_registry")
      .select("id")
      .eq("id", biaId)
      .eq("city_slug", options.appContext.citySlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate selected BIA: ${biaError.message}`);
    }
    if (!biaRow) {
      throw new Error("Selected BIA is not active for this city.");
    }

    const { error: closeError } = await options.supabase
      .from("store_bia_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("store_id", storeId)
      .is("effective_to", null);
    if (closeError) {
      throw new Error(`Failed to close previous BIA affiliation: ${closeError.message}`);
    }

    const { error: insertError } = await options.supabase.from("store_bia_affiliations").insert({
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
    const normalizedSlug = normaliseStoreSlug(assertValidStoreSlug(String(payload.slug ?? "")));

    const { data: existingSlugRows, error: existingSlugError } = await options.supabase
      .from("store_profiles")
      .select("store_id")
      .eq("app_instance_id", options.appContext.appInstanceId)
      .ilike("slug", normalizedSlug)
      .neq("store_id", storeId)
      .limit(1);

    if (existingSlugError) {
      throw new Error(`Failed to validate slug availability: ${existingSlugError.message}`);
    }
    if (Array.isArray(existingSlugRows) && existingSlugRows.length > 0) {
      throw new Error("Store slug is already in use.");
    }

    const { error: slugError } = await options.supabase
      .from("store_profiles")
      .upsert(
        {
          store_id: storeId,
          app_instance_id: options.appContext.appInstanceId,
          slug: normalizedSlug,
          updated_at: nowIso,
        },
        { onConflict: "store_id" }
      );
    if (slugError) {
      throw new Error(`Failed to save slug step: ${slugError.message}`);
    }
  }

  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("signup_step,signup_progress_count")
    .eq("id", storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (storeError) {
    throw new Error(`Failed to reload application progress: ${storeError.message}`);
  }

  const currentStep = Number(storeRow?.signup_step ?? 1);
  const currentProgress = Number(storeRow?.signup_progress_count ?? 0);
  const nextStep = Math.max(currentStep, step);

  const { error: progressError } = await options.supabase
    .from("stores")
    .update({
      signup_step: nextStep,
      signup_progress_count: Number.isFinite(currentProgress) ? currentProgress + 1 : 1,
    })
    .eq("id", storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", "draft");

  if (progressError) {
    throw new Error(`Failed to update signup progress: ${progressError.message}`);
  }

  const { error: eventError } = await options.supabase.from("store_signup_events").insert({
    store_id: storeId,
    user_id: options.userId,
    step,
    event_type: "step_saved",
    payload,
    created_at: nowIso,
  });

  if (eventError) {
    throw new Error(`Failed to log signup step event: ${eventError.message}`);
  }

  return {
    citySlug: options.appContext.citySlug,
    storeId,
    step,
    signupStep: nextStep,
    nextStep: Math.min(5, step + 1),
  };
}

export async function submitMerchantApplication(options: MerchantContext & { storeId: number }) {
  const access = await assertDraftStoreAdminAccess(options);
  if (access.lifecycleStatus !== "draft") {
    throw new Error("Only draft applications can be submitted.");
  }

  const [{ data: profile, error: profileError }, { data: biaAffiliation, error: biaError }] = await Promise.all([
    options.supabase
      .from("store_profiles")
      .select("display_name,description,logo_url,banner_url,address_text,lat,lng,slug")
      .eq("store_id", options.storeId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("store_bia_affiliations")
      .select("id,bia_id")
      .eq("store_id", options.storeId)
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
    return {
      error: "Application is incomplete. Complete all required steps before submission.",
      missingFields,
    };
  }

  const nowIso = new Date().toISOString();

  const { error: submitError } = await options.supabase
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
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", "draft");

  if (submitError) {
    throw new Error(`Failed to submit merchant application: ${submitError.message}`);
  }

  const { error: profileStatusError } = await options.supabase
    .from("store_profiles")
    .update({ status: "inactive", updated_at: nowIso })
    .eq("store_id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (profileStatusError) {
    throw new Error(`Failed to update store profile status after submission: ${profileStatusError.message}`);
  }

  const { error: eventError } = await options.supabase.from("store_signup_events").insert({
    store_id: options.storeId,
    user_id: options.userId,
    step: 5,
    event_type: "application_submitted",
    payload: {
      citySlug: options.appContext.citySlug,
      appInstanceId: options.appContext.appInstanceId,
      biaId: biaAffiliation?.bia_id ?? null,
    },
    created_at: nowIso,
  });

  if (eventError) {
    throw new Error(`Failed to log application submission event: ${eventError.message}`);
  }

  return {
    citySlug: options.appContext.citySlug,
    storeId: options.storeId,
    status: "pending",
    submittedAt: nowIso,
  };
}

export async function listCityManagerStores(options: MerchantContext & { status: string; limit: number }) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: storeRows, error: storeError } = await options.supabase
    .from("stores")
    .select(
      "id,app_instance_id,lifecycle_status,signup_step,signup_progress_count,created_at,submitted_at,approved_at,rejected_at,rejection_reason"
    )
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", options.status)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (storeError) {
    throw new Error(`Failed to load city-manager store list: ${storeError.message}`);
  }

  const storeIds = (storeRows ?? [])
    .map((row: any) => Number(row.id))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  if (storeIds.length === 0) {
    return {
      citySlug: options.appContext.citySlug,
      appInstanceId: options.appContext.appInstanceId,
      status: options.status,
      stores: [],
    };
  }

  const [{ data: profiles, error: profilesError }, { data: biaRows, error: biaError }, { data: adminEmployees, error: employeesError }] =
    await Promise.all([
      options.supabase
        .from("store_profiles")
        .select("store_id,display_name,slug,description,logo_url,banner_url,address_text,lat,lng,wallet_address,status")
        .in("store_id", storeIds),
      options.supabase
        .from("store_bia_affiliations")
        .select("store_id,bia_id,bia_registry!inner(id,code,name)")
        .in("store_id", storeIds)
        .is("effective_to", null),
      options.supabase
        .from("store_employees")
        .select("store_id,user_id,is_admin")
        .in("store_id", storeIds)
        .eq("is_admin", true),
    ]);

  if (profilesError) throw new Error(`Failed to load city-manager store profiles: ${profilesError.message}`);
  if (biaError) throw new Error(`Failed to load city-manager store BIAs: ${biaError.message}`);
  if (employeesError) throw new Error(`Failed to load city-manager store employees: ${employeesError.message}`);

  const applicantUserIds = Array.from(
    new Set((adminEmployees ?? []).map((row: any) => Number(row.user_id)).filter((value: number) => Number.isFinite(value) && value > 0))
  );

  const { data: userRows, error: userRowsError } =
    applicantUserIds.length === 0
      ? { data: [], error: null }
      : await options.supabase
          .from("users")
          .select("id,full_name,username,email,phone,country,address,profile_image_url,created_at")
          .in("id", applicantUserIds);

  if (userRowsError) {
    throw new Error(`Failed to load city-manager applicants: ${userRowsError.message}`);
  }

  const profileByStoreId = new Map((profiles ?? []).map((row: any) => [Number(row.store_id), row]));
  const biaByStoreId = new Map<number, { id: string; code: string; name: string }>();
  for (const row of biaRows ?? []) {
    const storeId = Number((row as any).store_id);
    const rawBia = Array.isArray((row as any).bia_registry) ? (row as any).bia_registry[0] : (row as any).bia_registry;
    if (!Number.isFinite(storeId) || !rawBia || typeof rawBia.id !== "string") {
      continue;
    }
    biaByStoreId.set(storeId, {
      id: rawBia.id,
      code: typeof rawBia.code === "string" ? rawBia.code : "BIA",
      name: typeof rawBia.name === "string" ? rawBia.name : rawBia.id,
    });
  }

  const adminByStoreId = new Map<number, number>();
  for (const row of adminEmployees ?? []) {
    const storeId = Number((row as any).store_id);
    const userId = Number((row as any).user_id);
    if (!Number.isFinite(storeId) || !Number.isFinite(userId) || adminByStoreId.has(storeId)) {
      continue;
    }
    adminByStoreId.set(storeId, userId);
  }

  const userById = new Map((userRows ?? []).map((row: any) => [Number(row.id), row]));
  const stores = (storeRows ?? []).map((row: any) => {
    const storeId = Number(row.id);
    const profile = profileByStoreId.get(storeId);
    const bia = biaByStoreId.get(storeId) ?? null;
    const applicantUserId = adminByStoreId.get(storeId) ?? null;
    const applicant = applicantUserId != null ? userById.get(applicantUserId) : null;

    return {
      storeId,
      appInstanceId: Number(row.app_instance_id ?? options.appContext.appInstanceId),
      lifecycleStatus: row.lifecycle_status,
      signupStep: Number(row.signup_step ?? 1),
      signupProgressCount: Number(row.signup_progress_count ?? 0),
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
      approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
      rejectedAt: typeof row.rejected_at === "string" ? row.rejected_at : null,
      rejectionReason: typeof row.rejection_reason === "string" ? row.rejection_reason : null,
      applicant: applicantUserId
        ? {
            userId: applicantUserId,
            fullName: typeof applicant?.full_name === "string" ? applicant.full_name : null,
            username: typeof applicant?.username === "string" ? applicant.username : null,
            email: typeof applicant?.email === "string" ? applicant.email : null,
            phone: typeof applicant?.phone === "string" ? applicant.phone : null,
            country: typeof applicant?.country === "string" ? applicant.country : null,
            address: typeof applicant?.address === "string" ? applicant.address : null,
            profileImageUrl: typeof applicant?.profile_image_url === "string" ? applicant.profile_image_url : null,
            createdAt: typeof applicant?.created_at === "string" ? applicant.created_at : null,
          }
        : null,
      profile: profile
        ? {
            displayName: typeof profile.display_name === "string" ? profile.display_name : null,
            slug: typeof profile.slug === "string" ? profile.slug : null,
            description: typeof profile.description === "string" ? profile.description : null,
            logoUrl: typeof profile.logo_url === "string" ? profile.logo_url : null,
            bannerUrl: typeof profile.banner_url === "string" ? profile.banner_url : null,
            addressText: typeof profile.address_text === "string" ? profile.address_text : null,
            lat: typeof profile.lat === "number" ? profile.lat : null,
            lng: typeof profile.lng === "number" ? profile.lng : null,
            walletAddress: typeof profile.wallet_address === "string" ? profile.wallet_address : null,
            status: typeof profile.status === "string" ? profile.status : null,
          }
        : null,
      bia,
    };
  });

  return {
    citySlug: options.appContext.citySlug,
    appInstanceId: options.appContext.appInstanceId,
    status: options.status,
    stores,
  };
}

export async function approveCityManagerStore(
  options: MerchantContext & { storeId: number; reason?: string }
) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("id,lifecycle_status")
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (storeError) throw new Error(`Failed to validate store for approval: ${storeError.message}`);
  if (!storeRow) throw new Error("Store not found in this app instance.");
  if (storeRow.lifecycle_status !== "pending") throw new Error("Only pending stores can be approved.");

  const nowIso = new Date().toISOString();
  const { error: approveError } = await options.supabase
    .from("stores")
    .update({
      lifecycle_status: "live",
      approved_at: nowIso,
      approved_by: options.userId,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
    })
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", "pending");

  if (approveError) throw new Error(`Failed to approve store application: ${approveError.message}`);

  const { error: profileError } = await options.supabase
    .from("store_profiles")
    .update({ status: "active", updated_at: nowIso })
    .eq("store_id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (profileError) throw new Error(`Failed to activate store profile on approval: ${profileError.message}`);

  await Promise.all([
    options.supabase.from("store_signup_events").insert({
      store_id: options.storeId,
      user_id: options.userId,
      step: 5,
      event_type: "application_approved",
      payload: {
        citySlug: options.appContext.citySlug,
        appInstanceId: options.appContext.appInstanceId,
        reason: options.reason ?? null,
      },
      created_at: nowIso,
    }),
    options.supabase.from("governance_actions_log").insert({
      action_type: "merchant_application_approved",
      city_slug: options.appContext.citySlug,
      store_id: options.storeId,
      actor_user_id: options.userId,
      reason: options.reason || "Merchant application approved",
      payload: {
        appInstanceId: options.appContext.appInstanceId,
        approvedAt: nowIso,
      },
    }),
  ]);

  return {
    citySlug: options.appContext.citySlug,
    appInstanceId: options.appContext.appInstanceId,
    storeId: options.storeId,
    status: "live",
    approvedAt: nowIso,
  };
}

export async function rejectCityManagerStore(
  options: MerchantContext & { storeId: number; reason: string }
) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("id,lifecycle_status")
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (storeError) throw new Error(`Failed to validate store for rejection: ${storeError.message}`);
  if (!storeRow) throw new Error("Store not found in this app instance.");
  if (storeRow.lifecycle_status !== "pending") throw new Error("Only pending stores can be rejected.");

  const nowIso = new Date().toISOString();
  const { error: rejectError } = await options.supabase
    .from("stores")
    .update({
      lifecycle_status: "rejected",
      rejected_at: nowIso,
      rejected_by: options.userId,
      rejection_reason: options.reason,
    })
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .eq("lifecycle_status", "pending");

  if (rejectError) throw new Error(`Failed to reject store application: ${rejectError.message}`);

  const { error: profileError } = await options.supabase
    .from("store_profiles")
    .update({ status: "inactive", updated_at: nowIso })
    .eq("store_id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (profileError) throw new Error(`Failed to set store profile inactive after rejection: ${profileError.message}`);

  await Promise.all([
    options.supabase.from("store_signup_events").insert({
      store_id: options.storeId,
      user_id: options.userId,
      step: 5,
      event_type: "application_rejected",
      payload: {
        citySlug: options.appContext.citySlug,
        appInstanceId: options.appContext.appInstanceId,
        reason: options.reason,
      },
      created_at: nowIso,
    }),
    options.supabase.from("governance_actions_log").insert({
      action_type: "merchant_application_rejected",
      city_slug: options.appContext.citySlug,
      store_id: options.storeId,
      actor_user_id: options.userId,
      reason: options.reason,
      payload: {
        appInstanceId: options.appContext.appInstanceId,
        rejectedAt: nowIso,
      },
    }),
  ]);

  return {
    citySlug: options.appContext.citySlug,
    appInstanceId: options.appContext.appInstanceId,
    storeId: options.storeId,
    status: "rejected",
    rejectedAt: nowIso,
    reason: options.reason,
  };
}
