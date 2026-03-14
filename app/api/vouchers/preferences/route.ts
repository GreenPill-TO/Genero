import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import type { VoucherTrustStatus } from "@shared/lib/vouchers/types";

function normalizeOptionalAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

function normalizeTrustStatus(value: unknown): VoucherTrustStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "trusted" || normalized === "blocked" || normalized === "default") {
    return normalized;
  }
  return null;
}

function buildPreferenceScopeQuery(options: {
  query: any;
  merchantStoreId: number | null;
  tokenAddress: Address | null;
}) {
  let query = options.query;

  if (options.merchantStoreId == null) {
    query = query.is("merchant_store_id", null);
  } else {
    query = query.eq("merchant_store_id", options.merchantStoreId);
  }

  if (options.tokenAddress == null) {
    query = query.is("token_address", null);
  } else {
    query = query.eq("token_address", options.tokenAddress);
  }

  return query;
}

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const { data, error } = await serviceRole
      .from("user_voucher_preferences")
      .select("id,city_slug,merchant_store_id,token_address,trust_status,created_at,updated_at")
      .eq("user_id", userRow.id)
      .eq("app_instance_id", appInstanceId)
      .eq("city_slug", citySlug)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load voucher preferences: ${error.message}`);
    }

    return NextResponse.json({
      citySlug,
      appInstanceId,
      preferences: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher preferences error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      merchantStoreId?: number | string | null;
      tokenAddress?: string | null;
      trustStatus?: string;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const trustStatus = normalizeTrustStatus(body.trustStatus);
    if (!trustStatus) {
      return NextResponse.json({ error: "trustStatus must be trusted, blocked, or default." }, { status: 400 });
    }

    const merchantStoreIdRaw = toNumber(body.merchantStoreId, 0);
    const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
    const tokenAddress = normalizeOptionalAddress(body.tokenAddress);
    const nowIso = new Date().toISOString();

    const existingQuery = buildPreferenceScopeQuery({
      query: serviceRole
        .from("user_voucher_preferences")
        .select("id")
        .eq("user_id", userRow.id)
        .eq("app_instance_id", appInstanceId)
        .eq("city_slug", citySlug),
      merchantStoreId,
      tokenAddress,
    });

    const { data: existing, error: existingError } = await existingQuery
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to find existing voucher preference: ${existingError.message}`);
    }

    let upserted: any;

    if (existing?.id) {
      const { data, error } = await serviceRole
        .from("user_voucher_preferences")
        .update({
          trust_status: trustStatus,
          updated_at: nowIso,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to update voucher preference: ${error.message}`);
      }

      upserted = data;
    } else {
      const { data, error } = await serviceRole
        .from("user_voucher_preferences")
        .insert({
          user_id: userRow.id,
          app_instance_id: appInstanceId,
          city_slug: citySlug,
          merchant_store_id: merchantStoreId,
          token_address: tokenAddress,
          trust_status: trustStatus,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to create voucher preference: ${error.message}`);
      }

      upserted = data;
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "voucher_preference_updated",
      city_slug: citySlug,
      actor_user_id: userRow.id,
      reason: "User updated voucher routing preferences",
      payload: {
        appInstanceId,
        merchantStoreId,
        tokenAddress,
        trustStatus,
      },
    });

    return NextResponse.json({ preference: upserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher preference update error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
