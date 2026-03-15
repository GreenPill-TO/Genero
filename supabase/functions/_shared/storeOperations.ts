import { isAddress } from "npm:viem@2.23.3";
import { assertStoreAdminAccess } from "./rbac.ts";
import { toNumber } from "./validation.ts";

type StoreContext = {
  supabase: any;
  userId: number;
  appContext: {
    citySlug: string;
    appInstanceId: number;
  };
};

export async function upsertStore(options: StoreContext & { payload: Record<string, unknown> }) {
  const body = options.payload;
  let storeId = Number(body.storeId ?? 0);
  const nowIso = new Date().toISOString();

  if (storeId > 0) {
    const { data: storeRow, error: storeError } = await options.supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      throw new Error(`Failed to validate store/app scope: ${storeError.message}`);
    }
    if (!storeRow) {
      throw new Error("Store not found in this app instance.");
    }

    await assertStoreAdminAccess({
      supabase: options.supabase,
      userId: options.userId,
      storeId,
      appInstanceId: options.appContext.appInstanceId,
    });
  } else {
    const { data: createdStore, error: createStoreError } = await options.supabase
      .from("stores")
      .insert({ app_instance_id: options.appContext.appInstanceId })
      .select("id")
      .single();

    if (createStoreError) {
      throw new Error(`Failed to create store: ${createStoreError.message}`);
    }

    storeId = Number(createdStore.id);
    const { data: existingEmployee, error: employeeReadError } = await options.supabase
      .from("store_employees")
      .select("store_id")
      .eq("store_id", storeId)
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .limit(1)
      .maybeSingle();

    if (employeeReadError) {
      throw new Error(`Failed to verify store employee row: ${employeeReadError.message}`);
    }

    if (!existingEmployee) {
      const { error: employeeError } = await options.supabase.from("store_employees").insert({
        store_id: storeId,
        user_id: options.userId,
        app_instance_id: options.appContext.appInstanceId,
        is_admin: true,
      });

      if (employeeError) {
        throw new Error(`Failed to assign current user as store employee: ${employeeError.message}`);
      }
    }
  }

  if (body.walletAddress && !isAddress(String(body.walletAddress))) {
    throw new Error("walletAddress must be a valid 0x address.");
  }

  const profilePayload = {
    store_id: storeId,
    display_name: typeof body.displayName === "string" ? body.displayName.trim() || null : null,
    wallet_address: typeof body.walletAddress === "string" ? body.walletAddress : null,
    address_text: typeof body.addressText === "string" ? body.addressText.trim() || null : null,
    lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : null,
    lng: Number.isFinite(Number(body.lng)) ? Number(body.lng) : null,
    status: typeof body.status === "string" ? body.status : "active",
    updated_at: nowIso,
  };

  const { data: storeProfile, error: profileError } = await options.supabase
    .from("store_profiles")
    .upsert(profilePayload, { onConflict: "store_id" })
    .select("*")
    .single();

  if (profileError) {
    throw new Error(`Failed to upsert store profile: ${profileError.message}`);
  }

  let affiliation = null;
  if (body.biaId) {
    const result = await assignStoreBia({
      ...options,
      storeId,
      payload: {
        biaId: body.biaId,
        source: body.source ?? "merchant_selected",
      },
    });
    affiliation = (result as { affiliation: unknown }).affiliation ?? null;
  } else {
    const { data: activeAffiliation } = await options.supabase
      .from("store_bia_affiliations")
      .select("*")
      .eq("store_id", storeId)
      .is("effective_to", null)
      .limit(1)
      .maybeSingle();

    affiliation = activeAffiliation;
  }

  await options.supabase.from("governance_actions_log").insert({
    action_type: "store_profile_upserted",
    city_slug: options.appContext.citySlug,
    bia_id: (affiliation as any)?.bia_id ?? null,
    store_id: storeId,
    actor_user_id: options.userId,
    reason: "Store profile updated via edge function",
    payload: {
      appInstanceId: options.appContext.appInstanceId,
      status: profilePayload.status,
      hasWalletAddress: Boolean(profilePayload.wallet_address),
      hasCoordinates:
        Number.isFinite(toNumber(profilePayload.lat, Number.NaN)) &&
        Number.isFinite(toNumber(profilePayload.lng, Number.NaN)),
    },
  });

  return {
    store: storeProfile,
    affiliation,
  };
}

export async function assignStoreBia(
  options: StoreContext & { storeId: number; payload: Record<string, unknown> }
) {
  const body = options.payload;
  const { data: storeRow, error: storeError } = await options.supabase
    .from("stores")
    .select("id")
    .eq("id", options.storeId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (storeError) {
    throw new Error(`Failed to validate store/app scope: ${storeError.message}`);
  }
  if (!storeRow) {
    throw new Error("Store not found in this app instance.");
  }

  await assertStoreAdminAccess({
    supabase: options.supabase,
    userId: options.userId,
    storeId: options.storeId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const biaId = String(body.biaId ?? "").trim();
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
    throw new Error(`Failed to validate BIA: ${biaError.message}`);
  }
  if (!biaRow) {
    throw new Error("BIA not found or inactive for this city.");
  }

  const nowIso = new Date().toISOString();
  const { error: closeError } = await options.supabase
    .from("store_bia_affiliations")
    .update({ effective_to: nowIso, updated_at: nowIso })
    .eq("store_id", options.storeId)
    .is("effective_to", null);

  if (closeError) {
    throw new Error(`Failed to close previous store affiliation: ${closeError.message}`);
  }

  const { data: inserted, error: insertError } = await options.supabase
    .from("store_bia_affiliations")
    .insert({
      store_id: options.storeId,
      bia_id: biaRow.id,
      source: typeof body.source === "string" ? body.source : "merchant_selected",
      effective_from: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to assign store to BIA: ${insertError.message}`);
  }

  await options.supabase.from("governance_actions_log").insert({
    action_type: "store_bia_assigned",
    city_slug: options.appContext.citySlug,
    bia_id: biaRow.id,
    store_id: options.storeId,
    actor_user_id: options.userId,
    reason: "Store BIA updated",
    payload: {
      appInstanceId: options.appContext.appInstanceId,
      source: typeof body.source === "string" ? body.source : "merchant_selected",
    },
  });

  return { affiliation: inserted };
}
