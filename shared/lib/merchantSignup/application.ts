import type { SupabaseClient } from "@supabase/supabase-js";
import { assertStoreAdminAccess } from "@shared/lib/bia/server";

export async function listUserDraftStoreIds(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
}): Promise<number[]> {
  const { data: employeeRows, error: employeeError } = await options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId);

  if (employeeError) {
    throw new Error(`Failed to resolve draft store ownership: ${employeeError.message}`);
  }

  const storeIds = (employeeRows ?? [])
    .map((row: any) => Number(row.store_id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (storeIds.length === 0) {
    return [];
  }

  const { data: draftRows, error: draftError } = await options.supabase
    .from("stores")
    .select("id")
    .eq("app_instance_id", options.appInstanceId)
    .eq("lifecycle_status", "draft")
    .in("id", storeIds);

  if (draftError) {
    throw new Error(`Failed to resolve draft stores: ${draftError.message}`);
  }

  return (draftRows ?? [])
    .map((row: any) => Number(row.id))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function clearDraftStores(options: {
  supabase: SupabaseClient<any, any, any>;
  draftStoreIds: number[];
}) {
  if (options.draftStoreIds.length === 0) {
    return;
  }

  const storeIds = options.draftStoreIds;

  const { error: eventsDeleteError } = await options.supabase
    .from("store_signup_events")
    .delete()
    .in("store_id", storeIds);

  if (eventsDeleteError) {
    throw new Error(`Failed to clear draft signup events: ${eventsDeleteError.message}`);
  }

  const { error: storeBiaDeleteError } = await options.supabase
    .from("store_bia_affiliations")
    .delete()
    .in("store_id", storeIds);

  if (storeBiaDeleteError) {
    throw new Error(`Failed to clear draft store BIA affiliations: ${storeBiaDeleteError.message}`);
  }

  const { error: profileDeleteError } = await options.supabase
    .from("store_profiles")
    .delete()
    .in("store_id", storeIds);

  if (profileDeleteError) {
    throw new Error(`Failed to clear draft store profiles: ${profileDeleteError.message}`);
  }

  const { error: employeesDeleteError } = await options.supabase
    .from("store_employees")
    .delete()
    .in("store_id", storeIds);

  if (employeesDeleteError) {
    throw new Error(`Failed to clear draft store employees: ${employeesDeleteError.message}`);
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

export async function createDraftStore(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
  citySlug: string;
}) {
  const nowIso = new Date().toISOString();

  const { data: createdStore, error: createStoreError } = await options.supabase
    .from("stores")
    .insert({
      app_instance_id: options.appInstanceId,
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
    app_instance_id: options.appInstanceId,
    is_admin: true,
    created_at: nowIso,
  });

  if (employeeError) {
    throw new Error(`Failed to create initial store admin employee: ${employeeError.message}`);
  }

  const { error: profileError } = await options.supabase.from("store_profiles").upsert(
    {
      store_id: storeId,
      app_instance_id: options.appInstanceId,
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
      citySlug: options.citySlug,
      appInstanceId: options.appInstanceId,
    },
    created_at: nowIso,
  });

  if (eventError) {
    throw new Error(`Failed to log application start event: ${eventError.message}`);
  }

  return { storeId, nowIso };
}

export async function assertDraftStoreAdminAccess(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
  storeId: number;
}) {
  await assertStoreAdminAccess({
    supabase: options.supabase,
    userId: options.userId,
    storeId: options.storeId,
    appInstanceId: options.appInstanceId,
  });

  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("id,lifecycle_status")
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appInstanceId)
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
