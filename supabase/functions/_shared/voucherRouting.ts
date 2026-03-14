export async function resolveActiveUserBiaSet(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}): Promise<{
  primaryBiaId: string | null;
  secondaryBiaIds: string[];
  allBiaIds: Set<string>;
}> {
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
    .map((row: Record<string, unknown>) => String(row.bia_id ?? "").trim())
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

export async function listMerchantsForVoucherScope(options: {
  supabase: any;
  citySlug: string;
  chainId: number;
  userId: number;
  appInstanceId: number;
  scope: "my_pool" | "city";
}) {
  const { data, error } = await options.supabase.rpc("get_voucher_merchants_v1", {
    p_city_slug: options.citySlug,
    p_chain_id: options.chainId,
    p_user_id: options.userId,
    p_app_instance_id: options.appInstanceId,
    p_scope: options.scope,
  });

  if (error) {
    throw new Error(`Failed to load voucher merchants from read model: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    merchantStoreId: Number(row.merchant_store_id),
    displayName: typeof row.display_name === "string" ? row.display_name : undefined,
    walletAddress: typeof row.wallet_address === "string" ? row.wallet_address : undefined,
    biaId: typeof row.bia_id === "string" ? row.bia_id : undefined,
    biaCode: typeof row.bia_code === "string" ? row.bia_code : undefined,
    biaName: typeof row.bia_name === "string" ? row.bia_name : undefined,
    chainId: typeof row.chain_id === "number" ? row.chain_id : options.chainId,
    poolAddress: typeof row.pool_address === "string" ? row.pool_address : undefined,
    tokenAddress: typeof row.token_address === "string" ? row.token_address : undefined,
    tokenSymbol: typeof row.token_symbol === "string" ? row.token_symbol : undefined,
    tokenName: typeof row.token_name === "string" ? row.token_name : undefined,
    tokenDecimals: typeof row.token_decimals === "number" ? row.token_decimals : undefined,
    voucherIssueLimit: row.voucher_issue_limit != null ? String(row.voucher_issue_limit) : null,
    requiredLiquidityAbsolute:
      row.required_liquidity_absolute != null ? String(row.required_liquidity_absolute) : null,
    requiredLiquidityRatio:
      row.required_liquidity_ratio != null ? String(row.required_liquidity_ratio) : null,
    creditIssued: row.credit_issued != null ? String(row.credit_issued) : undefined,
    creditRemaining: row.credit_remaining != null ? String(row.credit_remaining) : null,
    sourceMode: typeof row.source_mode === "string" ? row.source_mode : undefined,
    available: row.available === true,
  }));
}

export async function getVoucherCompatibilityRules(options: {
  supabase: any;
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
