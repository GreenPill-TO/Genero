import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { resolveVoucherRouteQuote } from "@shared/lib/vouchers/routing";

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

async function resolveRecipientWallet(options: {
  serviceRole: any;
  recipientWallet?: string | null;
  recipientUserId?: number;
}): Promise<Address | null> {
  const direct = normalizeAddress(options.recipientWallet);
  if (direct) {
    return direct;
  }

  if (!options.recipientUserId || !Number.isFinite(options.recipientUserId) || options.recipientUserId <= 0) {
    return null;
  }

  const { data, error } = await options.serviceRole
    .from("wallet_list")
    .select("public_key")
    .eq("user_id", options.recipientUserId)
    .eq("namespace", "EVM")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve recipient wallet address: ${error.message}`);
  }

  return normalizeAddress(data?.public_key);
}

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const amount = toNumber(url.searchParams.get("amount"), 0);
    const recipientUserId = Math.trunc(toNumber(url.searchParams.get("recipientUserId"), 0));
    const requestedChainId = toNumber(url.searchParams.get("chainId"), 0);

    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;

    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const recipientWallet = await resolveRecipientWallet({
      serviceRole,
      recipientWallet: url.searchParams.get("recipientWallet"),
      recipientUserId,
    });

    if (!recipientWallet) {
      return NextResponse.json(
        { error: "recipientWallet or recipientUserId with a valid wallet is required." },
        { status: 400 }
      );
    }

    const quote = await resolveVoucherRouteQuote({
      supabase: serviceRole,
      citySlug,
      chainId,
      userId: Number(userRow.id),
      appInstanceId,
      recipientWallet,
      amountInTcoin: amount,
    });

    return NextResponse.json({
      citySlug,
      chainId,
      appInstanceId,
      quote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher route error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
