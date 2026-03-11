import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";

type PaymentMode = "voucher" | "tcoin_fallback";

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

function normalizeMode(value: unknown): PaymentMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "voucher" || normalized === "tcoin_fallback") {
    return normalized;
  }
  return null;
}

function normalizeTxHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json()) as {
      citySlug?: string;
      chainId?: number | string;
      mode?: string;
      payerWallet?: string;
      recipientWallet?: string;
      merchantStoreId?: number | string;
      tokenAddress?: string;
      poolAddress?: string;
      amountTcoin?: number | string;
      amountVoucher?: number | string;
      swapTxHash?: string;
      transferTxHash?: string;
      fallbackReason?: string;
      status?: "submitted" | "completed" | "failed";
      metadata?: Record<string, unknown>;
    };

    const citySlug = resolveCitySlug(body.citySlug);
    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const requestedChainId = toNumber(body.chainId, 0);
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;

    const mode = normalizeMode(body.mode);
    if (!mode) {
      return NextResponse.json({ error: "mode must be voucher or tcoin_fallback." }, { status: 400 });
    }

    const merchantStoreIdRaw = toNumber(body.merchantStoreId, 0);
    const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;

    const nowIso = new Date().toISOString();
    const recordPayload = {
      city_slug: citySlug,
      chain_id: chainId,
      payer_user_id: Number(userRow.id),
      payer_wallet: normalizeAddress(body.payerWallet),
      recipient_wallet: normalizeAddress(body.recipientWallet),
      merchant_store_id: merchantStoreId,
      mode,
      token_address: normalizeAddress(body.tokenAddress),
      pool_address: normalizeAddress(body.poolAddress),
      amount_tcoin: toNumber(body.amountTcoin, 0),
      amount_voucher: toNumber(body.amountVoucher, 0),
      swap_tx_hash: normalizeTxHash(body.swapTxHash),
      transfer_tx_hash: normalizeTxHash(body.transferTxHash),
      fallback_reason:
        typeof body.fallbackReason === "string" && body.fallbackReason.trim() !== ""
          ? body.fallbackReason.trim()
          : null,
      status:
        body.status === "completed" || body.status === "failed" || body.status === "submitted"
          ? body.status
          : "submitted",
      metadata: body.metadata ?? {},
      updated_at: nowIso,
    };

    const { data, error } = await serviceRole
      .from("voucher_payment_records")
      .insert({
        ...recordPayload,
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to insert voucher payment record: ${error.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: "voucher_payment_recorded",
      city_slug: citySlug,
      store_id: merchantStoreId,
      actor_user_id: Number(userRow.id),
      reason: mode === "voucher" ? "Voucher merchant payment recorded" : "Fallback payment recorded",
      payload: {
        chainId,
        mode,
        merchantStoreId,
        tokenAddress: recordPayload.token_address,
        poolAddress: recordPayload.pool_address,
        swapTxHash: recordPayload.swap_tx_hash,
        transferTxHash: recordPayload.transfer_tx_hash,
        fallbackReason: recordPayload.fallback_reason,
      },
    });

    return NextResponse.json({ record: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher payment record error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
