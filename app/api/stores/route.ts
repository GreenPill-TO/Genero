import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertStoreAccess, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      storeId?: number;
      displayName?: string;
      walletAddress?: string;
      addressText?: string;
      lat?: number;
      lng?: number;
      status?: "active" | "inactive" | "suspended";
      biaId?: string;
      source?: "merchant_selected" | "suggested" | "admin_assigned" | "migrated";
      citySlug?: string;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });
    let storeId = Number(body.storeId ?? 0);
    const nowIso = new Date().toISOString();

    if (storeId > 0) {
      const { data: storeRow, error: storeError } = await serviceRole
        .from("stores")
        .select("id")
        .eq("id", storeId)
        .eq("app_instance_id", appInstanceId)
        .limit(1)
        .maybeSingle();

      if (storeError) {
        throw new Error(`Failed to validate store/app scope: ${storeError.message}`);
      }

      if (!storeRow) {
        return NextResponse.json({ error: "Store not found in this app instance." }, { status: 404 });
      }

      await assertStoreAccess({
        supabase: serviceRole,
        userId: Number(userRow.id),
        storeId,
        appInstanceId,
      });
    } else {
      const { data: createdStore, error: createStoreError } = await serviceRole
        .from("stores")
        .insert({ app_instance_id: appInstanceId })
        .select("id")
        .single();

      if (createStoreError) {
        throw new Error(`Failed to create store: ${createStoreError.message}`);
      }

      storeId = Number(createdStore.id);

      const { data: existingEmployee, error: employeeReadError } = await serviceRole
        .from("store_employees")
        .select("store_id")
        .eq("store_id", storeId)
        .eq("user_id", userRow.id)
        .eq("app_instance_id", appInstanceId)
        .limit(1)
        .maybeSingle();

      if (employeeReadError) {
        throw new Error(`Failed to verify store employee row: ${employeeReadError.message}`);
      }

      if (!existingEmployee) {
        const { error: employeeError } = await serviceRole.from("store_employees").insert({
          store_id: storeId,
          user_id: userRow.id,
          app_instance_id: appInstanceId,
        });

        if (employeeError) {
          throw new Error(`Failed to assign current user as store employee: ${employeeError.message}`);
        }
      }
    }

    if (body.walletAddress && !isAddress(body.walletAddress)) {
      return NextResponse.json({ error: "walletAddress must be a valid 0x address." }, { status: 400 });
    }

    const profilePayload = {
      store_id: storeId,
      display_name: body.displayName?.trim() || null,
      wallet_address: body.walletAddress ? body.walletAddress : null,
      address_text: body.addressText?.trim() || null,
      lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : null,
      lng: Number.isFinite(Number(body.lng)) ? Number(body.lng) : null,
      status: body.status ?? "active",
      updated_at: nowIso,
    };

    const { data: storeProfile, error: profileError } = await serviceRole
      .from("store_profiles")
      .upsert(profilePayload, { onConflict: "store_id" })
      .select("*")
      .single();

    if (profileError) {
      throw new Error(`Failed to upsert store profile: ${profileError.message}`);
    }

    let affiliation = null;

    if (body.biaId) {
      const { data: biaRow, error: biaError } = await serviceRole
        .from("bia_registry")
        .select("id")
        .eq("id", body.biaId)
        .eq("city_slug", citySlug)
        .limit(1)
        .maybeSingle();

      if (biaError) {
        throw new Error(`Failed to validate BIA: ${biaError.message}`);
      }

      if (!biaRow) {
        return NextResponse.json({ error: "Provided BIA does not exist for this city." }, { status: 400 });
      }

      const { error: closeError } = await serviceRole
        .from("store_bia_affiliations")
        .update({ effective_to: nowIso, updated_at: nowIso })
        .eq("store_id", storeId)
        .is("effective_to", null);

      if (closeError) {
        throw new Error(`Failed to close previous store affiliation: ${closeError.message}`);
      }

      const { data: affiliationRow, error: affiliationError } = await serviceRole
        .from("store_bia_affiliations")
        .insert({
          store_id: storeId,
          bia_id: biaRow.id,
          source: body.source ?? "merchant_selected",
          effective_from: nowIso,
          effective_to: null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (affiliationError) {
        throw new Error(`Failed to assign store BIA affiliation: ${affiliationError.message}`);
      }

      affiliation = affiliationRow;
    } else {
      const { data: activeAffiliation } = await serviceRole
        .from("store_bia_affiliations")
        .select("*")
        .eq("store_id", storeId)
        .is("effective_to", null)
        .limit(1)
        .maybeSingle();

      affiliation = activeAffiliation;
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "store_profile_upserted",
      city_slug: citySlug,
      bia_id: affiliation?.bia_id ?? null,
      store_id: storeId,
      actor_user_id: userRow.id,
      reason: "Store profile updated via API",
      payload: {
        appInstanceId,
        status: profilePayload.status,
        hasWalletAddress: Boolean(profilePayload.wallet_address),
        hasCoordinates: Number.isFinite(toNumber(profilePayload.lat, Number.NaN)) && Number.isFinite(toNumber(profilePayload.lng, Number.NaN)),
      },
    });

    return NextResponse.json({
      store: storeProfile,
      affiliation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error upserting store";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
