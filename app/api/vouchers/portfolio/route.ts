import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { buildVoucherPortfolio } from "@shared/lib/vouchers/valuation";
import type { VoucherBalance } from "@shared/lib/vouchers/types";

function normalizeWalletAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  return getAddress(trimmed);
}

async function resolveWalletAddress(options: {
  explicitWallet?: string | null;
  serviceRole: any;
  userId: number;
}): Promise<Address | null> {
  const explicit = normalizeWalletAddress(options.explicitWallet);
  if (explicit) {
    return explicit;
  }

  const { data, error } = await options.serviceRole
    .from("wallet_list")
    .select("public_key")
    .eq("user_id", options.userId)
    .eq("namespace", "EVM")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve wallet address: ${error.message}`);
  }

  return normalizeWalletAddress(data?.public_key);
}

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const requestedChainId = toNumber(url.searchParams.get("chainId"), 0);
    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;
    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const walletAddress = await resolveWalletAddress({
      explicitWallet: url.searchParams.get("wallet"),
      serviceRole,
      userId: Number(userRow.id),
    });

    if (!walletAddress) {
      return NextResponse.json({ error: "No EVM wallet address found for current user." }, { status: 400 });
    }

    const walletLower = walletAddress.toLowerCase();
    const scopeKey = `${citySlug}:${chainId}`;

    const [valueViewResult, voucherBalanceResult] = await Promise.all([
      serviceRole
        .from("v_wallet_total_value")
        .select("scope_key,chain_id,wallet_address,tcoin_balance,voucher_total,total_equivalent,updated_at")
        .eq("scope_key", scopeKey)
        .eq("chain_id", chainId)
        .eq("wallet_address", walletLower)
        .maybeSingle(),
      serviceRole
        .schema("indexer")
        .from("wallet_voucher_balances")
        .select("token_address,balance,updated_at")
        .eq("scope_key", scopeKey)
        .eq("chain_id", chainId)
        .eq("wallet_address", walletLower),
    ]);

    if (valueViewResult.error) {
      throw new Error(`Failed to load wallet total value view: ${valueViewResult.error.message}`);
    }

    if (voucherBalanceResult.error) {
      throw new Error(`Failed to load wallet voucher balances: ${voucherBalanceResult.error.message}`);
    }

    const tokenAddresses = Array.from(
      new Set(
        (voucherBalanceResult.data ?? [])
          .map((row: any) => normalizeWalletAddress(row.token_address))
          .filter((value): value is Address => value != null)
      )
    );

    const tokenMetadataResult =
      tokenAddresses.length > 0
        ? await serviceRole
            .schema("chain_data")
            .from("tokens")
            .select("contract_address,token_name,token_symbol,token_decimals")
            .eq("chain_id", chainId)
            .in("contract_address", tokenAddresses)
        : { data: [], error: null as any };

    if (tokenMetadataResult.error) {
      throw new Error(`Failed to load voucher token metadata: ${tokenMetadataResult.error.message}`);
    }

    const metadataByToken = new Map<string, any>();
    for (const row of tokenMetadataResult.data ?? []) {
      const tokenAddress = normalizeWalletAddress(row.contract_address);
      if (!tokenAddress) {
        continue;
      }
      metadataByToken.set(tokenAddress.toLowerCase(), row);
    }

    const vouchers: VoucherBalance[] = [];
    for (const row of voucherBalanceResult.data ?? []) {
      const tokenAddress = normalizeWalletAddress((row as any).token_address);
      if (!tokenAddress) {
        continue;
      }
      const metadata = metadataByToken.get(tokenAddress.toLowerCase());
      vouchers.push({
        chainId,
        walletAddress,
        tokenAddress,
        tokenName: typeof metadata?.token_name === "string" ? metadata.token_name : undefined,
        tokenSymbol: typeof metadata?.token_symbol === "string" ? metadata.token_symbol : undefined,
        tokenDecimals: typeof metadata?.token_decimals === "number" ? metadata.token_decimals : undefined,
        balance: String((row as any).balance ?? "0"),
        updatedAt: typeof (row as any).updated_at === "string" ? (row as any).updated_at : undefined,
      });
    }

    const portfolio = buildVoucherPortfolio({
      citySlug,
      chainId,
      walletAddress,
      tcoinBalance: valueViewResult.data?.tcoin_balance ?? 0,
      vouchers,
      updatedAt: valueViewResult.data?.updated_at ?? undefined,
    });

    return NextResponse.json({
      appInstanceId,
      scopeKey,
      portfolio,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher portfolio error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
