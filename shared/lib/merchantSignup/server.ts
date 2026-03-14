import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import type { MerchantApplicationProfile, StoreLifecycleStatus } from "@shared/lib/merchantSignup/types";

const LIFECYCLE_PRIORITY: StoreLifecycleStatus[] = ["draft", "pending", "live", "rejected"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isMerchantSignupEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_MERCHANT_SIGNUP_V1 ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
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

export async function resolveMerchantSignupContext(citySlugInput?: string) {
  const { serviceRole, userRow } = await resolveApiAuthContext();
  const citySlug = resolveCitySlug(citySlugInput);
  const appInstanceId = await resolveActiveAppInstanceId({
    supabase: serviceRole,
    citySlug,
  });

  return {
    serviceRole,
    userRow,
    citySlug,
    appInstanceId,
  };
}

export async function assertCityManagerAccess(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
}) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
  });
}

function asLifecycleStatus(value: unknown): StoreLifecycleStatus {
  if (value === "draft" || value === "pending" || value === "live" || value === "rejected") {
    return value;
  }
  return "draft";
}

function statusRank(status: StoreLifecycleStatus): number {
  const index = LIFECYCLE_PRIORITY.indexOf(status);
  return index === -1 ? 999 : index;
}

function recencyValue(row: any): number {
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

export async function resolveUserMerchantApplication(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
  citySlug: string;
}): Promise<MerchantApplicationProfile | null> {
  const { data: employeeRows, error: employeeError } = await options.supabase
    .from("store_employees")
    .select("store_id,is_admin")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId);

  if (employeeError) {
    throw new Error(`Failed to resolve merchant applications: ${employeeError.message}`);
  }

  const storeIds = (employeeRows ?? [])
    .map((row: any) => Number(row.store_id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (storeIds.length === 0) {
    return null;
  }

  const { data: stores, error: storesError } = await options.supabase
    .from("stores")
    .select(
      "id,app_instance_id,lifecycle_status,signup_step,signup_progress_count,submitted_at,approved_at,rejected_at,rejection_reason,created_at,signup_started_at"
    )
    .eq("app_instance_id", options.appInstanceId)
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
      .eq("app_instance_id", options.appInstanceId)
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
    appInstanceId: Number(selected.app_instance_id ?? options.appInstanceId),
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
      lat: (() => {
        const value = typeof profile?.lat === "number" ? profile.lat : toNumber(profile?.lat, Number.NaN);
        return Number.isFinite(value) ? value : null;
      })(),
      lng: (() => {
        const value = typeof profile?.lng === "number" ? profile.lng : toNumber(profile?.lng, Number.NaN);
        return Number.isFinite(value) ? value : null;
      })(),
      slug: typeof profile?.slug === "string" ? profile.slug : null,
    },
    bia:
      rawBia && typeof rawBia?.id === "string"
        ? {
            id: rawBia.id,
            code: typeof rawBia.code === "string" ? rawBia.code : "BIA",
            name: typeof rawBia.name === "string" ? rawBia.name : rawBia.id,
          }
        : null,
  };
}
