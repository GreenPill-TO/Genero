import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { getTorontoCoinRuntimeConfig } from "@shared/lib/contracts/torontocoinRuntime";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { resolveActiveBiaPoolMapping, resolveActiveUserBia } from "@shared/lib/sarafu/routing";
import { assertActiveMapping, assertBiaPoolNotFrozen, assertPoolTokenSupport } from "@shared/lib/sarafu/guards";

function normalizeOptionalAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    return null;
  }
  const checksummed = getAddress(trimmed);
  if (checksummed.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return checksummed;
}

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      chainId?: number | string;
      biaId?: string;
      fiatAmount?: number | string;
      tokenAmount?: number | string;
      tokenAddress?: string;
      txHash?: string;
      metadata?: Record<string, unknown>;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const chainId = Math.max(1, Math.trunc(toNumber(body.chainId, 42220)));
    const fiatAmount = toNumber(body.fiatAmount, 0);
    const tokenAmount = toNumber(body.tokenAmount, 0);

    if (!(fiatAmount > 0) || !(tokenAmount > 0)) {
      return NextResponse.json(
        { error: "fiatAmount and tokenAmount must both be positive numbers." },
        { status: 400 }
      );
    }

    const selectedBiaId = body.biaId
      ? body.biaId
      : await resolveActiveUserBia({
          supabase: serviceRole,
          userId: Number(userRow.id),
          appInstanceId,
        });

    if (!selectedBiaId) {
      return NextResponse.json(
        { error: "No active BIA affiliation found. Select a BIA before purchasing TCOIN." },
        { status: 400 }
      );
    }

    const mapping = await resolveActiveBiaPoolMapping({
      supabase: serviceRole,
      biaId: selectedBiaId,
      chainId,
    });
    assertActiveMapping(mapping);

    const { data: biaRow, error: biaError } = await serviceRole
      .from("bia_registry")
      .select("id,city_slug,status")
      .eq("id", selectedBiaId)
      .eq("city_slug", citySlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (biaError) {
      throw new Error(`Failed to validate selected BIA: ${biaError.message}`);
    }

    if (!biaRow) {
      return NextResponse.json({ error: "Selected BIA is not active in this city." }, { status: 400 });
    }

    await assertBiaPoolNotFrozen({
      supabase: serviceRole,
      biaId: selectedBiaId,
    });

    let tokenAddress = normalizeOptionalAddress(body.tokenAddress);

    if (!tokenAddress) {
      const torontoCoinRuntime = getTorontoCoinRuntimeConfig({ citySlug, chainId });
      if (torontoCoinRuntime) {
        tokenAddress = torontoCoinRuntime.cplTcoin.address;
      }
    }

    if (!tokenAddress) {
      try {
        const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
        if (activeContracts.chainId === chainId) {
          tokenAddress = getAddress(activeContracts.contracts.TCOIN);
        }
      } catch {
        tokenAddress = null;
      }
    }

    if (tokenAddress) {
      await assertPoolTokenSupport({
        chainId,
        poolAddress: mapping.poolAddress,
        tokenAddress,
      });
    }

    const nowIso = new Date().toISOString();
    let txHash: string | null = null;
    if (typeof body.txHash === "string" && body.txHash.trim() !== "") {
      const candidate = body.txHash.trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(candidate)) {
        return NextResponse.json({ error: "txHash must be a valid 0x transaction hash." }, { status: 400 });
      }
      txHash = candidate;
    }

    const { data: inserted, error: insertError } = await serviceRole
      .from("pool_purchase_requests")
      .insert({
        user_id: userRow.id,
        app_instance_id: appInstanceId,
        bia_id: selectedBiaId,
        chain_id: chainId,
        pool_address: mapping.poolAddress,
        token_address: tokenAddress,
        fiat_amount: fiatAmount,
        token_amount: tokenAmount,
        tx_hash: txHash,
        status: txHash ? "submitted" : "processing",
        metadata: {
          ...(body.metadata ?? {}),
          execution_mode: "request_queue",
          routing_source: body.biaId ? "request_bia" : "active_user_bia",
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(`Failed to create pool purchase request: ${insertError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "pool_purchase_requested",
      city_slug: citySlug,
      bia_id: selectedBiaId,
      actor_user_id: userRow.id,
      reason: "Pool-aware purchase request created",
      payload: {
        appInstanceId,
        chainId,
        poolAddress: mapping.poolAddress,
        tokenAddress,
        fiatAmount,
        tokenAmount,
      },
    });

    return NextResponse.json({
      request: inserted,
      routing: {
        citySlug,
        appInstanceId,
        chainId,
        biaId: selectedBiaId,
        poolAddress: mapping.poolAddress,
        tokenAddress,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error creating pool buy request";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : message.includes("No active BIA pool mapping") || message.includes("does not include")
            ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
