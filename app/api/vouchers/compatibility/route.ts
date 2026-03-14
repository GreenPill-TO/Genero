import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import {
  resolveActiveAppInstanceId,
  resolveCitySlug,
  toNumber,
  userHasAnyRole,
} from "@shared/lib/bia/server";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { getVoucherCompatibilityRules } from "@shared/lib/vouchers/routing";

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

export async function GET(req: Request) {
  try {
    const { serviceRole } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const requestedChainId = toNumber(url.searchParams.get("chainId"), 0);
    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;

    const rules = await getVoucherCompatibilityRules({
      supabase: serviceRole,
      citySlug,
      chainId,
    });

    return NextResponse.json({ citySlug, chainId, rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher compatibility read error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      chainId?: number | string;
      poolAddress?: string;
      tokenAddress?: string;
      merchantStoreId?: number | string | null;
      acceptedByDefault?: boolean;
      ruleStatus?: "active" | "inactive";
      reason?: string;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const canManage = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: admin/operator role required." }, { status: 403 });
    }

    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const requestedChainId = toNumber(body.chainId, 0);
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;

    const poolAddress = normalizeAddress(body.poolAddress);
    const tokenAddress = normalizeAddress(body.tokenAddress);
    if (!poolAddress || !tokenAddress) {
      return NextResponse.json({ error: "poolAddress and tokenAddress are required." }, { status: 400 });
    }

    const merchantStoreIdRaw = toNumber(body.merchantStoreId, 0);
    const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
    const acceptedByDefault = body.acceptedByDefault !== false;
    const ruleStatus = body.ruleStatus === "inactive" ? "inactive" : "active";
    const nowIso = new Date().toISOString();

    let existingQuery = serviceRole
      .from("voucher_compatibility_rules")
      .select("id")
      .eq("city_slug", citySlug)
      .eq("chain_id", chainId)
      .eq("pool_address", poolAddress)
      .eq("token_address", tokenAddress);

    if (merchantStoreId == null) {
      existingQuery = existingQuery.is("merchant_store_id", null);
    } else {
      existingQuery = existingQuery.eq("merchant_store_id", merchantStoreId);
    }

    const { data: existing, error: existingError } = await existingQuery.limit(1).maybeSingle();
    if (existingError) {
      throw new Error(`Failed to check existing compatibility rule: ${existingError.message}`);
    }

    let saved: any;
    if (existing?.id) {
      const { data, error } = await serviceRole
        .from("voucher_compatibility_rules")
        .update({
          accepted_by_default: acceptedByDefault,
          rule_status: ruleStatus,
          updated_at: nowIso,
          created_by: userRow.id,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to update compatibility rule: ${error.message}`);
      }

      saved = data;
    } else {
      const { data, error } = await serviceRole
        .from("voucher_compatibility_rules")
        .insert({
          city_slug: citySlug,
          chain_id: chainId,
          pool_address: poolAddress,
          token_address: tokenAddress,
          merchant_store_id: merchantStoreId,
          accepted_by_default: acceptedByDefault,
          rule_status: ruleStatus,
          created_by: userRow.id,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to create compatibility rule: ${error.message}`);
      }

      saved = data;
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "voucher_compatibility_updated",
      city_slug: citySlug,
      actor_user_id: userRow.id,
      reason: body.reason?.trim() || "Voucher compatibility rule updated",
      payload: {
        appInstanceId,
        chainId,
        poolAddress,
        tokenAddress,
        merchantStoreId,
        acceptedByDefault,
        ruleStatus,
      },
    });

    return NextResponse.json({ rule: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher compatibility update error";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
