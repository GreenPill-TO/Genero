import { NextResponse } from "next/server";
import { assertCityManagerAccess, resolveMerchantSignupContext } from "@shared/lib/merchantSignup/server";
import type { CityManagerStoreApplicationRecord, StoreLifecycleStatus } from "@shared/lib/merchantSignup/types";

const ALLOWED_STATUSES: StoreLifecycleStatus[] = ["pending", "live", "rejected", "draft"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") ?? "pending").trim().toLowerCase() as StoreLifecycleStatus;
    const status = ALLOWED_STATUSES.includes(statusParam) ? statusParam : "pending";
    const limit = Math.max(1, Math.min(250, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

    const { serviceRole, userRow, citySlug, appInstanceId } = await resolveMerchantSignupContext(
      url.searchParams.get("citySlug") ?? undefined
    );

    await assertCityManagerAccess({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const { data: storeRows, error: storeError } = await serviceRole
      .from("stores")
      .select(
        "id,app_instance_id,lifecycle_status,signup_step,signup_progress_count,created_at,submitted_at,approved_at,rejected_at,rejection_reason"
      )
      .eq("app_instance_id", appInstanceId)
      .eq("lifecycle_status", status)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (storeError) {
      throw new Error(`Failed to load city-manager store list: ${storeError.message}`);
    }

    const storeIds = (storeRows ?? [])
      .map((row: any) => Number(row.id))
      .filter((value: number) => Number.isFinite(value) && value > 0);

    if (storeIds.length === 0) {
      return NextResponse.json({ citySlug, appInstanceId, status, stores: [] });
    }

    const [{ data: profiles, error: profilesError }, { data: biaRows, error: biaError }, { data: adminEmployees, error: employeesError }] =
      await Promise.all([
        serviceRole
          .from("store_profiles")
          .select("store_id,display_name,slug,description,logo_url,banner_url,address_text,lat,lng,wallet_address,status")
          .in("store_id", storeIds),
        serviceRole
          .from("store_bia_affiliations")
          .select("store_id,bia_id,bia_registry!inner(id,code,name)")
          .in("store_id", storeIds)
          .is("effective_to", null),
        serviceRole
          .from("store_employees")
          .select("store_id,user_id,is_admin")
          .in("store_id", storeIds)
          .eq("is_admin", true),
      ]);

    if (profilesError) {
      throw new Error(`Failed to load city-manager store profiles: ${profilesError.message}`);
    }

    if (biaError) {
      throw new Error(`Failed to load city-manager store BIAs: ${biaError.message}`);
    }

    if (employeesError) {
      throw new Error(`Failed to load city-manager store employees: ${employeesError.message}`);
    }

    const applicantUserIds = Array.from(
      new Set(
        (adminEmployees ?? [])
          .map((row: any) => Number(row.user_id))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    const { data: userRows, error: userRowsError } =
      applicantUserIds.length === 0
        ? { data: [] as any[], error: null }
        : await serviceRole.from("users").select("id,full_name,email").in("id", applicantUserIds);

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

    const stores: CityManagerStoreApplicationRecord[] = (storeRows ?? []).map((row: any) => {
      const storeId = Number(row.id);
      const profile = profileByStoreId.get(storeId);
      const bia = biaByStoreId.get(storeId) ?? null;
      const applicantUserId = adminByStoreId.get(storeId) ?? null;
      const applicant = applicantUserId != null ? userById.get(applicantUserId) : null;

      return {
        storeId,
        appInstanceId: Number(row.app_instance_id ?? appInstanceId),
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
              email: typeof applicant?.email === "string" ? applicant.email : null,
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

    return NextResponse.json({
      citySlug,
      appInstanceId,
      status,
      stores,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading city-manager stores";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
