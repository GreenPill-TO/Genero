import { getAddress, isAddress, type Address } from "npm:viem@2.23.3";
import { resolveVoucherRouteQuote } from "./voucherRouting.ts";
import { TORONTOCOIN_RUNTIME, getTorontoCoinRuntimeConfig } from "./torontocoinRuntime.ts";

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

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function formatAmount(value: number): string {
  return value.toFixed(6);
}

function buildVoucherPortfolio(options: {
  citySlug: string;
  chainId: number;
  walletAddress: Address;
  tcoinBalance: number | string;
  vouchers: Array<{
    chainId: number;
    walletAddress: Address;
    tokenAddress: Address;
    tokenName?: string;
    tokenSymbol?: string;
    tokenDecimals?: number;
    balance: string;
    updatedAt?: string;
  }>;
  updatedAt?: string;
}) {
  const tcoinBalanceNumber = toNumber(options.tcoinBalance, 0);
  const voucherEquivalent = options.vouchers.reduce((sum, voucher) => sum + toNumber(voucher.balance, 0), 0);
  const totalEquivalent = tcoinBalanceNumber + voucherEquivalent;

  return {
    citySlug: options.citySlug,
    chainId: options.chainId,
    walletAddress: options.walletAddress,
    tcoinBalance: formatAmount(tcoinBalanceNumber),
    voucherBalances: options.vouchers,
    voucherEquivalent: formatAmount(voucherEquivalent),
    totalEquivalent: formatAmount(totalEquivalent),
    breakdown: [
      {
        kind: "tcoin",
        symbol: "TCOIN",
        amount: formatAmount(tcoinBalanceNumber),
        equivalent: formatAmount(tcoinBalanceNumber),
      },
      ...options.vouchers.map((voucher) => ({
        kind: "voucher" as const,
        tokenAddress: voucher.tokenAddress,
        symbol: voucher.tokenSymbol ?? "VOUCHER",
        amount: formatAmount(toNumber(voucher.balance, 0)),
        equivalent: formatAmount(toNumber(voucher.balance, 0)),
      })),
    ],
    updatedAt: options.updatedAt,
  };
}

async function resolveWalletAddress(options: {
  explicitWallet?: string | null;
  supabase: any;
  userId: number;
}) {
  const explicit = normalizeAddress(options.explicitWallet);
  if (explicit) {
    return explicit;
  }

  const { data, error } = await options.supabase
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

  return normalizeAddress(data?.public_key);
}

async function resolveRecipientWallet(options: {
  supabase: any;
  recipientWallet?: string | null;
  recipientUserId?: number | null;
}) {
  const direct = normalizeAddress(options.recipientWallet);
  if (direct) {
    return direct;
  }

  if (!options.recipientUserId || !Number.isFinite(options.recipientUserId) || options.recipientUserId <= 0) {
    return null;
  }

  const { data, error } = await options.supabase
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

export async function getVoucherPortfolioRuntime(options: {
  supabase: any;
  userId: number;
  citySlug: string;
  appInstanceId: number;
  chainId?: number | null;
  wallet?: string | null;
}) {
  const runtime =
    getTorontoCoinRuntimeConfig({
      citySlug: options.citySlug,
      chainId: options.chainId ?? TORONTOCOIN_RUNTIME.chainId,
    }) ?? TORONTOCOIN_RUNTIME;
  const chainId = options.chainId && options.chainId > 0 ? Math.trunc(options.chainId) : runtime.chainId;

  const walletAddress = await resolveWalletAddress({
    explicitWallet: options.wallet,
    supabase: options.supabase,
    userId: options.userId,
  });

  if (!walletAddress) {
    throw new Error("No EVM wallet address found for current user.");
  }

  const walletLower = walletAddress.toLowerCase();
  const scopeKey = `${options.citySlug}:${chainId}`;

  const [valueViewResult, voucherBalanceResult] = await Promise.all([
    options.supabase
      .from("v_wallet_total_value")
      .select("scope_key,chain_id,wallet_address,tcoin_balance,voucher_total,total_equivalent,updated_at")
      .eq("scope_key", scopeKey)
      .eq("chain_id", chainId)
      .eq("wallet_address", walletLower)
      .maybeSingle(),
    options.supabase
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
        .map((row: Record<string, unknown>) => normalizeAddress(row.token_address))
        .filter((value): value is Address => value != null)
    )
  );

  const tokenMetadataResult =
    tokenAddresses.length > 0
      ? await options.supabase
          .schema("chain_data")
          .from("tokens")
          .select("contract_address,token_name,token_symbol,token_decimals")
          .eq("chain_id", chainId)
          .in("contract_address", tokenAddresses)
      : { data: [], error: null as { message?: string } | null };

  if (tokenMetadataResult.error) {
    throw new Error(`Failed to load voucher token metadata: ${tokenMetadataResult.error.message}`);
  }

  const metadataByToken = new Map<string, Record<string, unknown>>();
  for (const row of tokenMetadataResult.data ?? []) {
    const tokenAddress = normalizeAddress((row as Record<string, unknown>).contract_address);
    if (!tokenAddress) {
      continue;
    }
    metadataByToken.set(tokenAddress.toLowerCase(), row as Record<string, unknown>);
  }

  const vouchers = (voucherBalanceResult.data ?? [])
    .map((row: Record<string, unknown>) => {
      const tokenAddress = normalizeAddress(row.token_address);
      if (!tokenAddress) {
        return null;
      }
      const metadata = metadataByToken.get(tokenAddress.toLowerCase());
      return {
        chainId,
        walletAddress,
        tokenAddress,
        tokenName: typeof metadata?.token_name === "string" ? metadata.token_name : undefined,
        tokenSymbol: typeof metadata?.token_symbol === "string" ? metadata.token_symbol : undefined,
        tokenDecimals: typeof metadata?.token_decimals === "number" ? metadata.token_decimals : undefined,
        balance: String(row.balance ?? "0"),
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);

  return {
    appInstanceId: options.appInstanceId,
    scopeKey,
    portfolio: buildVoucherPortfolio({
      citySlug: options.citySlug,
      chainId,
      walletAddress,
      tcoinBalance: valueViewResult.data?.tcoin_balance ?? 0,
      vouchers,
      updatedAt: (valueViewResult.data as Record<string, unknown> | null)?.updated_at as string | undefined,
    }),
  };
}

export async function getVoucherRouteRuntime(options: {
  supabase: any;
  userId: number;
  citySlug: string;
  appInstanceId: number;
  chainId?: number | null;
  amount: number;
  recipientWallet?: string | null;
  recipientUserId?: number | null;
}) {
  const runtime =
    getTorontoCoinRuntimeConfig({
      citySlug: options.citySlug,
      chainId: options.chainId ?? TORONTOCOIN_RUNTIME.chainId,
    }) ?? TORONTOCOIN_RUNTIME;
  const chainId = options.chainId && options.chainId > 0 ? Math.trunc(options.chainId) : runtime.chainId;

  const recipientWallet = await resolveRecipientWallet({
    supabase: options.supabase,
    recipientWallet: options.recipientWallet,
    recipientUserId: options.recipientUserId,
  });

  if (!recipientWallet) {
    throw new Error("recipientWallet or recipientUserId with a valid wallet is required.");
  }

  const quote = await resolveVoucherRouteQuote({
    supabase: options.supabase,
    citySlug: options.citySlug,
    chainId,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    tcoinAddress: runtime.cplTcoin.address,
    tcoinDecimals: runtime.cplTcoin.decimals,
    recipientWallet,
    amountInTcoin: options.amount,
  });

  return {
    citySlug: options.citySlug,
    chainId,
    appInstanceId: options.appInstanceId,
    quote,
  };
}

export async function createVoucherPaymentRecordRuntime(options: {
  supabase: any;
  userId: number;
  citySlug: string;
  chainId?: number | null;
  payload: Record<string, unknown>;
}) {
  const runtime =
    getTorontoCoinRuntimeConfig({
      citySlug: options.citySlug,
      chainId: options.chainId ?? TORONTOCOIN_RUNTIME.chainId,
    }) ?? TORONTOCOIN_RUNTIME;
  const chainId = options.chainId && options.chainId > 0 ? Math.trunc(options.chainId) : runtime.chainId;
  const body = options.payload;

  const mode =
    body.mode === "voucher" || body.mode === "tcoin_fallback" ? body.mode : null;
  if (!mode) {
    throw new Error("mode must be voucher or tcoin_fallback.");
  }

  const merchantStoreIdRaw = toNumber(body.merchantStoreId, 0);
  const merchantStoreId = merchantStoreIdRaw > 0 ? Math.trunc(merchantStoreIdRaw) : null;
  const nowIso = new Date().toISOString();

  const recordPayload = {
    city_slug: options.citySlug,
    chain_id: chainId,
    payer_user_id: options.userId,
    payer_wallet: normalizeAddress(body.payerWallet),
    recipient_wallet: normalizeAddress(body.recipientWallet),
    merchant_store_id: merchantStoreId,
    mode,
    token_address: normalizeAddress(body.tokenAddress),
    pool_address: normalizeAddress(body.poolAddress),
    amount_tcoin: toNumber(body.amountTcoin, 0),
    amount_voucher: toNumber(body.amountVoucher, 0),
    swap_tx_hash:
      typeof body.swapTxHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(body.swapTxHash.trim())
        ? body.swapTxHash.trim()
        : null,
    transfer_tx_hash:
      typeof body.transferTxHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(body.transferTxHash.trim())
        ? body.transferTxHash.trim()
        : null,
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

  const { data, error } = await options.supabase
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

  await options.supabase.from("governance_actions_log").insert({
    action_type: "voucher_payment_recorded",
    city_slug: options.citySlug,
    store_id: merchantStoreId,
    actor_user_id: options.userId,
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

  return { record: data };
}
