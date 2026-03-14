import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUnits, getAddress, isAddress, parseUnits, type Address } from "viem";
import type {
  MerchantVoucherLiquidity,
  VoucherPreference,
  VoucherRouteQuote,
  VoucherToken,
} from "./types";
import { resolveTrustStatus } from "./preferences";
import { quoteSarafuPoolSwap, readSarafuPoolContext } from "@shared/lib/sarafu/client";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !isAddress(trimmed)) {
    return null;
  }
  const checksummed = getAddress(trimmed);
  if (checksummed.toLowerCase() === ZERO_ADDRESS) {
    return null;
  }
  return checksummed;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toFixedAmount(value: number): string {
  return value.toFixed(6);
}

type ActiveUserBiaSet = {
  primaryBiaId: string | null;
  secondaryBiaIds: string[];
  allBiaIds: Set<string>;
};

export async function resolveActiveUserBiaSet(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
}): Promise<ActiveUserBiaSet> {
  const [{ data: primaryRows, error: primaryError }, { data: secondaryRows, error: secondaryError }] =
    await Promise.all([
      options.supabase
        .from("user_bia_affiliations")
        .select("bia_id")
        .eq("user_id", options.userId)
        .eq("app_instance_id", options.appInstanceId)
        .is("effective_to", null)
        .limit(1),
      options.supabase
        .from("user_bia_secondary_affiliations")
        .select("bia_id")
        .eq("user_id", options.userId)
        .eq("app_instance_id", options.appInstanceId)
        .is("effective_to", null),
    ]);

  if (primaryError) {
    throw new Error(`Failed to resolve primary BIA affiliation: ${primaryError.message}`);
  }

  if (secondaryError) {
    throw new Error(`Failed to resolve secondary BIA affiliations: ${secondaryError.message}`);
  }

  const primaryBiaId = (primaryRows?.[0]?.bia_id as string | undefined) ?? null;
  const secondaryBiaIds = (secondaryRows ?? [])
    .map((row) => String(row.bia_id ?? "").trim())
    .filter((value) => value.length > 0 && value !== primaryBiaId);

  const allBiaIds = new Set<string>();
  if (primaryBiaId) {
    allBiaIds.add(primaryBiaId);
  }
  for (const biaId of secondaryBiaIds) {
    allBiaIds.add(biaId);
  }

  return {
    primaryBiaId,
    secondaryBiaIds,
    allBiaIds,
  };
}

export async function listVoucherTokensForPool(options: {
  supabase: SupabaseClient<any, any, any>;
  chainId: number;
  poolAddress: Address;
}): Promise<VoucherToken[]> {
  const { data, error } = await options.supabase
    .schema("indexer")
    .from("voucher_tokens")
    .select(
      "chain_id,token_address,pool_address,merchant_wallet,merchant_store_id,token_name,token_symbol,token_decimals,is_active,first_seen_at,last_seen_at,updated_at"
    )
    .eq("chain_id", options.chainId)
    .eq("pool_address", options.poolAddress)
    .eq("is_active", true)
    .order("token_symbol", { ascending: true });

  if (error) {
    throw new Error(`Failed to load voucher tokens for pool: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const tokenAddress = normalizeAddress(row.token_address);
      const poolAddress = normalizeAddress(row.pool_address);
      if (!tokenAddress || !poolAddress) {
        return null;
      }

      return {
        chainId: Number(row.chain_id),
        tokenAddress,
        poolAddress,
        merchantWallet: normalizeAddress(row.merchant_wallet) ?? undefined,
        merchantStoreId: typeof row.merchant_store_id === "number" ? row.merchant_store_id : undefined,
        tokenName: typeof row.token_name === "string" ? row.token_name : undefined,
        tokenSymbol: typeof row.token_symbol === "string" ? row.token_symbol : undefined,
        tokenDecimals:
          typeof row.token_decimals === "number" && Number.isFinite(row.token_decimals)
            ? row.token_decimals
            : undefined,
        isActive: Boolean(row.is_active),
        firstSeenAt: String(row.first_seen_at ?? new Date(0).toISOString()),
        lastSeenAt: String(row.last_seen_at ?? new Date(0).toISOString()),
        updatedAt: String(row.updated_at ?? new Date(0).toISOString()),
      } as VoucherToken;
    })
    .filter((row): row is VoucherToken => row != null);
}

async function resolveMerchantByWallet(options: {
  supabase: SupabaseClient<any, any, any>;
  walletAddress: Address;
}) {
  const { data, error } = await options.supabase
    .from("store_profiles")
    .select("store_id,display_name,wallet_address,status")
    .ilike("wallet_address", options.walletAddress)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve merchant store profile: ${error.message}`);
  }

  return data;
}

async function resolveMerchantBia(options: {
  supabase: SupabaseClient<any, any, any>;
  storeId: number;
}) {
  const { data, error } = await options.supabase
    .from("store_bia_affiliations")
    .select("bia_id")
    .eq("store_id", options.storeId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve merchant BIA affiliation: ${error.message}`);
  }

  return (data?.bia_id as string | undefined) ?? null;
}

async function resolvePoolMapping(options: {
  supabase: SupabaseClient<any, any, any>;
  biaId: string;
  chainId: number;
}) {
  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("pool_address,mapping_status,effective_to")
    .eq("bia_id", options.biaId)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve merchant pool mapping: ${error.message}`);
  }

  return data;
}

function buildFallbackRoute(options: {
  citySlug: string;
  chainId: number;
  recipientWallet: Address;
  amountInTcoin: string;
  reason: string;
  decisions?: string[];
  merchantStoreId?: number;
}): VoucherRouteQuote {
  return {
    mode: "tcoin_fallback",
    reason: options.reason,
    quoteSource: "fallback",
    citySlug: options.citySlug,
    chainId: options.chainId,
    recipientWallet: options.recipientWallet,
    merchantStoreId: options.merchantStoreId,
    amountInTcoin: options.amountInTcoin,
    guardDecisions: options.decisions ?? [options.reason],
  };
}

export async function resolveVoucherRouteQuote(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
  userId: number;
  appInstanceId: number;
  tcoinAddress: Address;
  tcoinDecimals?: number;
  recipientWallet: Address;
  amountInTcoin: number;
}): Promise<VoucherRouteQuote> {
  const amountInTcoin = toFixedAmount(Math.max(0, options.amountInTcoin));

  if (!(options.amountInTcoin > 0)) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      reason: "Invalid payment amount for voucher routing.",
      decisions: ["quoteSource=fallback: invalid amount"],
    });
  }

  const merchantStore = await resolveMerchantByWallet({
    supabase: options.supabase,
    walletAddress: options.recipientWallet,
  });

  if (!merchantStore?.store_id) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      reason: "Recipient is not an active merchant store.",
      decisions: ["quoteSource=fallback: recipient not merchant"],
    });
  }

  const merchantStoreId = Number(merchantStore.store_id);
  const merchantBiaId = await resolveMerchantBia({
    supabase: options.supabase,
    storeId: merchantStoreId,
  });

  if (!merchantBiaId) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      merchantStoreId,
      reason: "Merchant is not assigned to an active BIA.",
      decisions: ["quoteSource=fallback: missing merchant BIA mapping"],
    });
  }

  const mapping = await resolvePoolMapping({
    supabase: options.supabase,
    biaId: merchantBiaId,
    chainId: options.chainId,
  });

  const poolAddress = normalizeAddress(mapping?.pool_address);
  if (!poolAddress) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      merchantStoreId,
      reason: "Merchant BIA does not have an active Sarafu pool mapping.",
      decisions: ["quoteSource=fallback: missing active pool mapping"],
    });
  }

  const [voucherTokens, userBiaScope, preferencesResult, compatibilityResult] = await Promise.all([
    listVoucherTokensForPool({
      supabase: options.supabase,
      chainId: options.chainId,
      poolAddress,
    }),
    resolveActiveUserBiaSet({
      supabase: options.supabase,
      userId: options.userId,
      appInstanceId: options.appInstanceId,
    }),
    options.supabase
      .from("user_voucher_preferences")
      .select("id,user_id,app_instance_id,city_slug,merchant_store_id,token_address,trust_status,created_at,updated_at")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .eq("city_slug", options.citySlug),
    options.supabase
      .from("voucher_compatibility_rules")
      .select("token_address,merchant_store_id,accepted_by_default")
      .eq("city_slug", options.citySlug)
      .eq("chain_id", options.chainId)
      .eq("pool_address", poolAddress)
      .eq("rule_status", "active"),
  ]);

  if (preferencesResult.error) {
    throw new Error(`Failed to load voucher preferences: ${preferencesResult.error.message}`);
  }

  if (compatibilityResult.error) {
    throw new Error(`Failed to load voucher compatibility rules: ${compatibilityResult.error.message}`);
  }

  if (voucherTokens.length === 0) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      merchantStoreId,
      reason: "No active voucher tokens are indexed for this merchant pool.",
      decisions: ["quoteSource=fallback: no indexed voucher tokens"],
    });
  }

  const preferences: VoucherPreference[] = (preferencesResult.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    userId: Number(row.user_id),
    appInstanceId: Number(row.app_instance_id),
    citySlug: String(row.city_slug ?? options.citySlug),
    merchantStoreId: typeof row.merchant_store_id === "number" ? row.merchant_store_id : undefined,
    tokenAddress: normalizeAddress(row.token_address) ?? undefined,
    trustStatus: String(row.trust_status ?? "default") as VoucherPreference["trustStatus"],
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }));

  const compatibilityRules = (compatibilityResult.data ?? []).map((row) => ({
    merchantStoreId: typeof row.merchant_store_id === "number" ? row.merchant_store_id : null,
    tokenAddress: normalizeAddress(row.token_address),
    acceptedByDefault: Boolean(row.accepted_by_default),
  }));

  const isInUserBiaScope =
    userBiaScope.allBiaIds.size === 0 || userBiaScope.allBiaIds.has(merchantBiaId);

  const evaluated: Array<{
    token: VoucherToken;
    accepted: boolean;
    reason: string;
  }> = [];

  for (const token of voucherTokens) {
    const tokenAddressLower = token.tokenAddress.toLowerCase();

    const merchantRule = compatibilityRules.find(
      (rule) =>
        rule.tokenAddress?.toLowerCase() === tokenAddressLower && rule.merchantStoreId === merchantStoreId
    );

    const poolRule = compatibilityRules.find(
      (rule) =>
        rule.tokenAddress?.toLowerCase() === tokenAddressLower && (rule.merchantStoreId == null || rule.merchantStoreId === 0)
    );

    const compatibilityDefault = merchantRule
      ? merchantRule.acceptedByDefault
      : poolRule
        ? poolRule.acceptedByDefault
        : true;

    const defaultAccepted = isInUserBiaScope && compatibilityDefault;

    const trust = resolveTrustStatus({
      preferences,
      merchantStoreId,
      tokenAddress: token.tokenAddress,
      defaultAccepted,
    });

    evaluated.push({
      token,
      accepted: trust.accepted,
      reason: `${token.tokenSymbol ?? token.tokenAddress}: ${trust.reason}`,
    });
  }

  const selected = evaluated.find((candidate) => candidate.accepted);

  if (!selected) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      merchantStoreId,
      reason: "No voucher route passed compatibility and preference guards.",
      decisions: evaluated.map((item) => item.reason),
    });
  }

  const tokenDecimals = typeof selected.token.tokenDecimals === "number" ? selected.token.tokenDecimals : 18;
  const amountInUnits = parseUnits(amountInTcoin, options.tcoinDecimals ?? 18);
  const poolContext = await readSarafuPoolContext({
    chainId: options.chainId,
    poolAddress,
  });
  const quoted = await quoteSarafuPoolSwap({
    chainId: options.chainId,
    poolAddress,
    quoterAddress: poolContext.quoter,
    tokenOut: selected.token.tokenAddress,
    tokenIn: options.tcoinAddress,
    amountIn: amountInUnits,
  });

  if (!quoted || quoted.expectedOut <= BigInt(0)) {
    return buildFallbackRoute({
      citySlug: options.citySlug,
      chainId: options.chainId,
      recipientWallet: options.recipientWallet,
      amountInTcoin,
      merchantStoreId,
      reason: "Voucher route quote unavailable from pool/quoter.",
      decisions: ["quoteSource=fallback: pool_getQuote and quoter_valueFor unavailable"],
    });
  }

  const slippageBps = 100;
  const minOutUnits = (quoted.expectedOut * BigInt(10_000 - slippageBps)) / BigInt(10_000);
  const expectedOut = Number.parseFloat(formatUnits(quoted.expectedOut, tokenDecimals));
  const minOut = Number.parseFloat(formatUnits(minOutUnits, tokenDecimals));
  const feePpm =
    quoted.feePpm != null && quoted.feePpm <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(quoted.feePpm)
      : undefined;

  return {
    mode: "voucher",
    reason: "Voucher route selected for merchant payment.",
    citySlug: options.citySlug,
    chainId: options.chainId,
    recipientWallet: options.recipientWallet,
    merchantStoreId,
    poolAddress,
    tokenAddress: selected.token.tokenAddress,
    tokenSymbol: selected.token.tokenSymbol,
    tokenDecimals,
    amountInTcoin,
    expectedVoucherOut: toFixedAmount(expectedOut),
    minVoucherOut: toFixedAmount(minOut),
    quoteSource: quoted.quoteSource,
    feePpm,
    slippageBps,
    guardDecisions: [
      ...evaluated.map((item) => item.reason),
      `quoteSource=${quoted.quoteSource}`,
      feePpm != null ? `feePpm=${feePpm}` : "feePpm=unknown",
    ],
  };
}

export async function listMerchantsForVoucherScope(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
  userId: number;
  appInstanceId: number;
  scope: "my_pool" | "city";
}): Promise<MerchantVoucherLiquidity[]> {
  const [storeRowsResult, userBiaSet] = await Promise.all([
    options.supabase
      .from("store_profiles")
      .select("store_id,display_name,wallet_address,status")
      .eq("status", "active")
      .order("store_id", { ascending: true }),
    resolveActiveUserBiaSet({
      supabase: options.supabase,
      userId: options.userId,
      appInstanceId: options.appInstanceId,
    }),
  ]);

  if (storeRowsResult.error) {
    throw new Error(`Failed to load store profiles for voucher merchants: ${storeRowsResult.error.message}`);
  }

  const storeRows = storeRowsResult.data ?? [];
  if (storeRows.length === 0) {
    return [];
  }

  const storeIds = storeRows.map((row) => Number(row.store_id)).filter((value) => Number.isFinite(value));

  const [{ data: storeBiaRows, error: storeBiaError }, { data: mappingRows, error: mappingError }] =
    await Promise.all([
      options.supabase
        .from("store_bia_affiliations")
        .select("store_id,bia_id,bia_registry(code,name)")
        .in("store_id", storeIds)
        .is("effective_to", null),
      options.supabase
        .from("bia_pool_mappings")
        .select("bia_id,pool_address")
        .eq("chain_id", options.chainId)
        .eq("mapping_status", "active")
        .is("effective_to", null),
    ]);

  if (storeBiaError) {
    throw new Error(`Failed to load store BIA affiliations for voucher merchants: ${storeBiaError.message}`);
  }

  if (mappingError) {
    throw new Error(`Failed to load BIA pool mappings for voucher merchants: ${mappingError.message}`);
  }

  const biaByStore = new Map<number, { biaId: string; code?: string; name?: string }>();
  for (const row of storeBiaRows ?? []) {
    const storeId = Number(row.store_id);
    if (!Number.isFinite(storeId)) {
      continue;
    }

    const biaInfo = (Array.isArray(row.bia_registry) ? row.bia_registry[0] : row.bia_registry) as
      | { code?: string; name?: string }
      | null;

    biaByStore.set(storeId, {
      biaId: String(row.bia_id ?? ""),
      code: typeof biaInfo?.code === "string" ? biaInfo.code : undefined,
      name: typeof biaInfo?.name === "string" ? biaInfo.name : undefined,
    });
  }

  const poolByBia = new Map<string, Address>();
  for (const row of mappingRows ?? []) {
    const poolAddress = normalizeAddress(row.pool_address);
    const biaId = String(row.bia_id ?? "").trim();
    if (!poolAddress || !biaId) {
      continue;
    }
    poolByBia.set(biaId, poolAddress);
  }

  const poolAddresses = Array.from(new Set(Array.from(poolByBia.values()).map((value) => value.toLowerCase())));

  const [voucherRowsResult, creditRowsResult] = await Promise.all([
    poolAddresses.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : options.supabase
          .schema("indexer")
          .from("voucher_tokens")
          .select("pool_address,token_address,token_symbol,token_name,token_decimals,is_active")
          .eq("chain_id", options.chainId)
          .eq("is_active", true)
          .in("pool_address", poolAddresses),
    poolAddresses.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : options.supabase
          .schema("indexer")
          .from("merchant_credit_state")
          .select(
            "pool_address,merchant_wallet,token_address,credit_limit,required_liquidity_absolute,required_liquidity_ratio,credit_issued,credit_remaining,source_mode"
          )
          .eq("scope_key", `${options.citySlug}:${options.chainId}`)
          .eq("chain_id", options.chainId)
          .in("pool_address", poolAddresses),
  ]);

  if (voucherRowsResult.error) {
    throw new Error(`Failed to load voucher token rows for merchants: ${voucherRowsResult.error.message}`);
  }

  if (creditRowsResult.error) {
    throw new Error(`Failed to load merchant credit rows for merchants: ${creditRowsResult.error.message}`);
  }

  const vouchersByPool = new Map<string, any[]>();
  for (const row of voucherRowsResult.data ?? []) {
    const poolAddress = normalizeAddress(row.pool_address);
    if (!poolAddress) {
      continue;
    }
    const key = poolAddress.toLowerCase();
    const bucket = vouchersByPool.get(key) ?? [];
    bucket.push(row);
    vouchersByPool.set(key, bucket);
  }

  const creditByMerchantPoolToken = new Map<string, any>();
  for (const row of creditRowsResult.data ?? []) {
    const poolAddress = normalizeAddress(row.pool_address);
    const merchantWallet = normalizeAddress(row.merchant_wallet);
    const tokenAddress = normalizeAddress(row.token_address);
    if (!poolAddress || !merchantWallet || !tokenAddress) {
      continue;
    }

    const key = `${poolAddress.toLowerCase()}:${merchantWallet.toLowerCase()}:${tokenAddress.toLowerCase()}`;
    creditByMerchantPoolToken.set(key, row);
  }

  const entries: MerchantVoucherLiquidity[] = [];

  for (const store of storeRows) {
    const storeId = Number(store.store_id);
    if (!Number.isFinite(storeId)) {
      continue;
    }

    const storeWallet = normalizeAddress(store.wallet_address);
    const bia = biaByStore.get(storeId);
    const poolAddress = bia ? poolByBia.get(bia.biaId) : undefined;

    if (options.scope === "my_pool" && bia && userBiaSet.allBiaIds.size > 0 && !userBiaSet.allBiaIds.has(bia.biaId)) {
      continue;
    }

    const voucherRows = poolAddress ? vouchersByPool.get(poolAddress.toLowerCase()) ?? [] : [];

    if (voucherRows.length === 0) {
      entries.push({
        merchantStoreId: storeId,
        displayName: typeof store.display_name === "string" ? store.display_name : undefined,
        walletAddress: storeWallet ?? undefined,
        biaId: bia?.biaId,
        biaCode: bia?.code,
        biaName: bia?.name,
        chainId: options.chainId,
        poolAddress,
        available: false,
      });
      continue;
    }

    for (const voucher of voucherRows) {
      const tokenAddress = normalizeAddress(voucher.token_address);
      if (!tokenAddress) {
        continue;
      }

      const creditKey =
        poolAddress && storeWallet
          ? `${poolAddress.toLowerCase()}:${storeWallet.toLowerCase()}:${tokenAddress.toLowerCase()}`
          : "";
      const credit = creditByMerchantPoolToken.get(creditKey);

      entries.push({
        merchantStoreId: storeId,
        displayName: typeof store.display_name === "string" ? store.display_name : undefined,
        walletAddress: storeWallet ?? undefined,
        biaId: bia?.biaId,
        biaCode: bia?.code,
        biaName: bia?.name,
        chainId: options.chainId,
        poolAddress,
        tokenAddress,
        tokenSymbol: typeof voucher.token_symbol === "string" ? voucher.token_symbol : undefined,
        tokenName: typeof voucher.token_name === "string" ? voucher.token_name : undefined,
        tokenDecimals: typeof voucher.token_decimals === "number" ? voucher.token_decimals : undefined,
        voucherIssueLimit: credit?.credit_limit != null ? String(credit.credit_limit) : null,
        requiredLiquidityAbsolute:
          credit?.required_liquidity_absolute != null ? String(credit.required_liquidity_absolute) : null,
        requiredLiquidityRatio:
          credit?.required_liquidity_ratio != null ? String(credit.required_liquidity_ratio) : null,
        creditIssued: credit?.credit_issued != null ? String(credit.credit_issued) : undefined,
        creditRemaining: credit?.credit_remaining != null ? String(credit.credit_remaining) : null,
        sourceMode: credit?.source_mode === "contract_field" ? "contract_field" : "derived_supply",
        available: true,
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.merchantStoreId !== b.merchantStoreId) {
      return a.merchantStoreId - b.merchantStoreId;
    }
    return (a.tokenSymbol ?? "").localeCompare(b.tokenSymbol ?? "");
  });
}

export async function getVoucherCompatibilityRules(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug: string;
  chainId: number;
}) {
  const { data, error } = await options.supabase
    .from("voucher_compatibility_rules")
    .select("*")
    .eq("city_slug", options.citySlug)
    .eq("chain_id", options.chainId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load voucher compatibility rules: ${error.message}`);
  }

  return data ?? [];
}
