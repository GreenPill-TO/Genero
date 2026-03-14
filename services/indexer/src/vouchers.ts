import type { SupabaseClient } from "@supabase/supabase-js";
import { getAddress, isAddress, type Address, type PublicClient } from "viem";
import type { CityContractSet, TrackedPoolLink, VoucherScopeSummary } from "./types";

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);

function toAddress(value: unknown): Address | null {
  if (typeof value !== "string" || !isAddress(value)) {
    return null;
  }
  return getAddress(value);
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value.trim());
    } catch {
      return BIGINT_ZERO;
    }
  }
  return BIGINT_ZERO;
}

function pow10BigInt(decimals: number): bigint {
  let value = BIGINT_ONE;
  const safeDecimals = Math.max(0, Math.trunc(decimals));
  for (let i = 0; i < safeDecimals; i += 1) {
    value *= BigInt(10);
  }
  return value;
}

function toDecimalString(raw: bigint, decimals: number): string {
  const sign = raw < BIGINT_ZERO ? "-" : "";
  const base = raw < BIGINT_ZERO ? -raw : raw;
  const unit = pow10BigInt(Math.max(0, decimals));
  const whole = base / unit;
  const fraction = base % unit;
  if (fraction === BIGINT_ZERO) {
    return `${sign}${whole.toString()}`;
  }

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}.${fractionText}`;
}

function parseTokenDecimals(value: unknown, fallback = 18): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 36) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 36) {
      return parsed;
    }
  }
  return fallback;
}

async function loadTokenMetadata(options: {
  supabase: SupabaseClient<any, any, any>;
  chainId: number;
  tokenAddresses: Address[];
}) {
  if (options.tokenAddresses.length === 0) {
    return new Map<string, { token_name?: string; token_symbol?: string; token_decimals: number }>();
  }

  const { data, error } = await options.supabase
    .schema("chain_data")
    .from("tokens")
    .select("contract_address,token_name,token_symbol,token_decimals")
    .eq("chain_id", options.chainId)
    .in("contract_address", options.tokenAddresses);

  if (error) {
    throw new Error(`Failed to load token metadata for voucher derivation: ${error.message}`);
  }

  const map = new Map<string, { token_name?: string; token_symbol?: string; token_decimals: number }>();
  for (const row of data ?? []) {
    const tokenAddress = toAddress(row.contract_address);
    if (!tokenAddress) {
      continue;
    }

    map.set(tokenAddress.toLowerCase(), {
      token_name: typeof row.token_name === "string" ? row.token_name : undefined,
      token_symbol: typeof row.token_symbol === "string" ? row.token_symbol : undefined,
      token_decimals: parseTokenDecimals(row.token_decimals, 18),
    });
  }

  return map;
}

async function collectTokenActivity(options: {
  supabase: SupabaseClient<any, any, any>;
  chainId: number;
  tokenAddresses: Address[];
}) {
  if (options.tokenAddresses.length === 0) {
    return {
      balances: new Map<string, bigint>(),
      maxBlock: 0,
    };
  }

  const [transferResult, mintResult, burnResult] = await Promise.all([
    options.supabase
      .schema("chain_data")
      .from("token_transfer")
      .select("block_number,contract_address,sender_address,recipient_address,transfer_value")
      .eq("chain_id", options.chainId)
      .in("contract_address", options.tokenAddresses),
    options.supabase
      .schema("chain_data")
      .from("token_mint")
      .select("block_number,contract_address,recipient_address,mint_value")
      .eq("chain_id", options.chainId)
      .in("contract_address", options.tokenAddresses),
    options.supabase
      .schema("chain_data")
      .from("token_burn")
      .select("block_number,contract_address,burner_address,burn_value")
      .eq("chain_id", options.chainId)
      .in("contract_address", options.tokenAddresses),
  ]);

  if (transferResult.error) {
    throw new Error(`Failed to load token transfer activity: ${transferResult.error.message}`);
  }
  if (mintResult.error) {
    throw new Error(`Failed to load token mint activity: ${mintResult.error.message}`);
  }
  if (burnResult.error) {
    throw new Error(`Failed to load token burn activity: ${burnResult.error.message}`);
  }

  const balances = new Map<string, bigint>();
  let maxBlock = 0;

  const applyDelta = (wallet: unknown, token: unknown, delta: bigint) => {
    const walletAddress = toAddress(wallet);
    const tokenAddress = toAddress(token);
    if (!walletAddress || !tokenAddress) {
      return;
    }

    const key = `${walletAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`;
    const current = balances.get(key) ?? BIGINT_ZERO;
    balances.set(key, current + delta);
  };

  for (const row of transferResult.data ?? []) {
    const value = toBigInt(row.transfer_value);
    const block = Number(row.block_number ?? 0);
    if (block > maxBlock) {
      maxBlock = block;
    }

    applyDelta(row.sender_address, row.contract_address, -value);
    applyDelta(row.recipient_address, row.contract_address, value);
  }

  for (const row of mintResult.data ?? []) {
    const value = toBigInt(row.mint_value);
    const block = Number(row.block_number ?? 0);
    if (block > maxBlock) {
      maxBlock = block;
    }

    applyDelta(row.recipient_address, row.contract_address, value);
  }

  for (const row of burnResult.data ?? []) {
    const value = toBigInt(row.burn_value);
    const block = Number(row.block_number ?? 0);
    if (block > maxBlock) {
      maxBlock = block;
    }

    applyDelta(row.burner_address, row.contract_address, -value);
  }

  return {
    balances,
    maxBlock,
  };
}

function dedupeAddresses(values: Address[]): Address[] {
  const seen = new Set<string>();
  const output: Address[] = [];

  for (const address of values) {
    const normalized = address.toLowerCase();
    if (!seen.has(normalized)) {
      output.push(getAddress(address));
      seen.add(normalized);
    }
  }

  return output;
}

function extractBigintResult(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const part of value) {
      if (typeof part === "bigint") {
        return part;
      }
    }
  }
  return null;
}

async function readOptionalUint256(options: {
  client: PublicClient;
  address: Address;
  functionNames: string[];
  args: Address[];
}): Promise<bigint | null> {
  for (const functionName of options.functionNames) {
    try {
      const abiInputs = options.args.map((_, index) => ({
        name: `arg${index}`,
        type: "address",
      }));

      const abi = [
        {
          type: "function",
          name: functionName,
          stateMutability: "view",
          inputs: abiInputs,
          outputs: [{ name: "value", type: "uint256" }],
        },
      ] as const;

      const result = await options.client.readContract({
        address: options.address,
        abi: abi as any,
        functionName: functionName as any,
        args: options.args as any,
      });

      const parsed = extractBigintResult(result);
      if (parsed != null) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function readOnchainCreditParameters(options: {
  client: PublicClient;
  poolAddress: Address;
  limiterAddress?: Address;
  tokenAddress: Address;
  decimals: number;
}): Promise<{
  creditLimit: string | null;
  requiredLiquidityAbsolute: string | null;
  requiredLiquidityRatio: string | null;
  sourceMode: "contract_field" | "derived_supply";
}> {
  const limitFromLimiter =
    options.limiterAddress != null
      ? await readOptionalUint256({
          client: options.client,
          address: options.limiterAddress,
          functionNames: ["limitOf"],
          args: [options.tokenAddress, options.poolAddress],
        })
      : null;

  const limitFromPool = await readOptionalUint256({
    client: options.client,
    address: options.poolAddress,
    functionNames: ["limitOf"],
    args: [options.tokenAddress, options.poolAddress],
  });

  const requiredLiquidityAbsolute =
    (await readOptionalUint256({
      client: options.client,
      address: options.poolAddress,
      functionNames: [
        "requiredLiquidity",
        "requiredLiquidityFor",
        "minimumLiquidity",
        "minimumLiquidityFor",
        "minLiquidity",
      ],
      args: [options.tokenAddress],
    })) ??
    (options.limiterAddress
      ? await readOptionalUint256({
          client: options.client,
          address: options.limiterAddress,
          functionNames: [
            "requiredLiquidity",
            "requiredLiquidityFor",
            "minimumLiquidity",
            "minimumLiquidityFor",
            "minLiquidity",
          ],
          args: [options.tokenAddress],
        })
      : null);

  const requiredLiquidityRatio =
    (await readOptionalUint256({
      client: options.client,
      address: options.poolAddress,
      functionNames: ["requiredLiquidityRatio", "liquidityRatio", "liquidityRequirementRatio"],
      args: [options.tokenAddress],
    })) ??
    (options.limiterAddress
      ? await readOptionalUint256({
          client: options.client,
          address: options.limiterAddress,
          functionNames: ["requiredLiquidityRatio", "liquidityRatio", "liquidityRequirementRatio"],
          args: [options.tokenAddress],
        })
      : null);

  const rawLimit = limitFromLimiter ?? limitFromPool;
  const hasContractField = rawLimit != null || requiredLiquidityAbsolute != null || requiredLiquidityRatio != null;

  return {
    creditLimit: rawLimit != null ? toDecimalString(rawLimit, options.decimals) : null,
    requiredLiquidityAbsolute:
      requiredLiquidityAbsolute != null ? toDecimalString(requiredLiquidityAbsolute, options.decimals) : null,
    requiredLiquidityRatio: requiredLiquidityRatio != null ? requiredLiquidityRatio.toString() : null,
    sourceMode: hasContractField ? "contract_field" : "derived_supply",
  };
}

function getCoreTokenSet(cityContracts: CityContractSet): Set<string> {
  const set = new Set<string>();
  const candidates = [
    cityContracts.contracts.TCOIN,
    cityContracts.contracts.TTC,
    cityContracts.contracts.CAD,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      set.add(candidate.toLowerCase());
    }
  }

  return set;
}

function extractVoucherPairs(options: {
  activePools: TrackedPoolLink[];
  cityContracts: CityContractSet;
}) {
  const coreTokens = getCoreTokenSet(options.cityContracts);
  const pairs: Array<{ poolAddress: Address; tokenAddress: Address }> = [];

  for (const pool of options.activePools) {
    const poolAddress = getAddress(pool.poolAddress);
    for (const tokenAddress of pool.tokenAddresses) {
      const token = getAddress(tokenAddress);
      if (coreTokens.has(token.toLowerCase())) {
        continue;
      }
      pairs.push({ poolAddress, tokenAddress: token });
    }
  }

  return pairs;
}

export async function deriveVoucherState(options: {
  supabase: SupabaseClient<any, any, any>;
  client: PublicClient;
  scopeKey: string;
  chainId: number;
  cityContracts: CityContractSet;
  activePools: TrackedPoolLink[];
}): Promise<VoucherScopeSummary> {
  const nowIso = new Date().toISOString();
  const voucherPairs = extractVoucherPairs({
    activePools: options.activePools,
    cityContracts: options.cityContracts,
  });

  const tokenAddresses = dedupeAddresses(voucherPairs.map((pair) => pair.tokenAddress));
  const metadataByToken = await loadTokenMetadata({
    supabase: options.supabase,
    chainId: options.chainId,
    tokenAddresses,
  });

  const activePoolAddresses = dedupeAddresses(options.activePools.map((pool) => pool.poolAddress));
  const limiterByPool = new Map<string, Address>();
  for (const pool of options.activePools) {
    if (pool.tokenLimiter) {
      limiterByPool.set(pool.poolAddress.toLowerCase(), pool.tokenLimiter);
    }
  }

  if (activePoolAddresses.length > 0) {
    const { error: deactivateError } = await options.supabase
      .schema("indexer")
      .from("voucher_tokens")
      .update({ is_active: false, updated_at: nowIso })
      .eq("chain_id", options.chainId)
      .in("pool_address", activePoolAddresses);

    if (deactivateError) {
      throw new Error(`Failed to deactivate stale voucher token rows: ${deactivateError.message}`);
    }
  }

  if (voucherPairs.length > 0) {
    const upsertRows = voucherPairs.map((pair) => {
      const metadata = metadataByToken.get(pair.tokenAddress.toLowerCase());
      return {
        chain_id: options.chainId,
        token_address: pair.tokenAddress,
        pool_address: pair.poolAddress,
        merchant_wallet: null,
        merchant_store_id: null,
        token_name: metadata?.token_name ?? null,
        token_symbol: metadata?.token_symbol ?? null,
        token_decimals: metadata?.token_decimals ?? 18,
        is_active: true,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        updated_at: nowIso,
      };
    });

    const { error: upsertError } = await options.supabase
      .schema("indexer")
      .from("voucher_tokens")
      .upsert(upsertRows, { onConflict: "chain_id,token_address,pool_address" });

    if (upsertError) {
      throw new Error(`Failed to upsert voucher token rows: ${upsertError.message}`);
    }
  }

  const voucherActivity = await collectTokenActivity({
    supabase: options.supabase,
    chainId: options.chainId,
    tokenAddresses,
  });

  const voucherBalanceRows: Array<Record<string, unknown>> = [];

  for (const [key, rawBalance] of Array.from(voucherActivity.balances.entries())) {
    const [walletAddress, tokenAddress] = key.split(":");
    const metadata = metadataByToken.get(tokenAddress);
    const decimals = metadata?.token_decimals ?? 18;

    if (rawBalance <= BIGINT_ZERO) {
      continue;
    }

    voucherBalanceRows.push({
      scope_key: options.scopeKey,
      chain_id: options.chainId,
      wallet_address: walletAddress,
      token_address: tokenAddress,
      balance: toDecimalString(rawBalance, decimals),
      last_block: voucherActivity.maxBlock,
      updated_at: nowIso,
    });
  }

  const { error: clearVoucherBalanceError } = await options.supabase
    .schema("indexer")
    .from("wallet_voucher_balances")
    .delete()
    .eq("scope_key", options.scopeKey)
    .eq("chain_id", options.chainId);

  if (clearVoucherBalanceError) {
    throw new Error(`Failed to clear wallet voucher balance snapshots: ${clearVoucherBalanceError.message}`);
  }

  if (voucherBalanceRows.length > 0) {
    const { error: upsertVoucherBalanceError } = await options.supabase
      .schema("indexer")
      .from("wallet_voucher_balances")
      .upsert(voucherBalanceRows, { onConflict: "scope_key,chain_id,wallet_address,token_address" });

    if (upsertVoucherBalanceError) {
      throw new Error(`Failed to upsert wallet voucher balances: ${upsertVoucherBalanceError.message}`);
    }
  }

  const tcoinAddress = options.cityContracts.contracts.TCOIN ? getAddress(options.cityContracts.contracts.TCOIN) : null;
  if (tcoinAddress) {
    const tcoinMetadata = await loadTokenMetadata({
      supabase: options.supabase,
      chainId: options.chainId,
      tokenAddresses: [tcoinAddress],
    });

    const tcoinActivity = await collectTokenActivity({
      supabase: options.supabase,
      chainId: options.chainId,
      tokenAddresses: [tcoinAddress],
    });

    const decimals = tcoinMetadata.get(tcoinAddress.toLowerCase())?.token_decimals ?? 18;
    const tcoinRows: Array<Record<string, unknown>> = [];

    for (const [key, rawBalance] of Array.from(tcoinActivity.balances.entries())) {
      const [walletAddress] = key.split(":");
      if (rawBalance <= BIGINT_ZERO) {
        continue;
      }

      tcoinRows.push({
        scope_key: options.scopeKey,
        chain_id: options.chainId,
        wallet_address: walletAddress,
        balance: toDecimalString(rawBalance, decimals),
        last_block: tcoinActivity.maxBlock,
        updated_at: nowIso,
      });
    }

    const { error: clearTcoinBalanceError } = await options.supabase
      .schema("indexer")
      .from("wallet_tcoin_balances")
      .delete()
      .eq("scope_key", options.scopeKey)
      .eq("chain_id", options.chainId);

    if (clearTcoinBalanceError) {
      throw new Error(`Failed to clear wallet TCOIN balance snapshots: ${clearTcoinBalanceError.message}`);
    }

    if (tcoinRows.length > 0) {
      const { error: upsertTcoinBalanceError } = await options.supabase
        .schema("indexer")
        .from("wallet_tcoin_balances")
        .upsert(tcoinRows, { onConflict: "scope_key,chain_id,wallet_address" });

      if (upsertTcoinBalanceError) {
        throw new Error(`Failed to upsert wallet TCOIN balances: ${upsertTcoinBalanceError.message}`);
      }
    }
  }

  const { data: merchantRows, error: merchantRowsError } = await options.supabase
    .from("store_profiles")
    .select("store_id,wallet_address")
    .eq("status", "active");

  if (merchantRowsError) {
    throw new Error(`Failed to load merchant rows for credit derivation: ${merchantRowsError.message}`);
  }

  const storeIds = (merchantRows ?? [])
    .map((row) => Number(row.store_id))
    .filter((value) => Number.isFinite(value));

  const [storeBiaResult, mappingResult] = await Promise.all([
    storeIds.length === 0
      ? Promise.resolve({ data: [] as any[], error: null as any })
      : options.supabase
          .from("store_bia_affiliations")
          .select("store_id,bia_id")
          .in("store_id", storeIds)
          .is("effective_to", null),
    options.supabase
      .from("bia_pool_mappings")
      .select("bia_id,pool_address")
      .eq("chain_id", options.chainId)
      .eq("mapping_status", "active")
      .is("effective_to", null),
  ]);

  if (storeBiaResult.error) {
    throw new Error(`Failed to load store BIA rows for credit derivation: ${storeBiaResult.error.message}`);
  }

  if (mappingResult.error) {
    throw new Error(`Failed to load mapping rows for credit derivation: ${mappingResult.error.message}`);
  }

  const poolByBia = new Map<string, string>();
  for (const row of mappingResult.data ?? []) {
    const poolAddress = toAddress(row.pool_address);
    const biaId = String(row.bia_id ?? "").trim();
    if (!poolAddress || !biaId) {
      continue;
    }
    poolByBia.set(biaId, poolAddress.toLowerCase());
  }

  const biaByStore = new Map<number, string>();
  for (const row of storeBiaResult.data ?? []) {
    const storeId = Number(row.store_id);
    const biaId = String(row.bia_id ?? "").trim();
    if (!Number.isFinite(storeId) || !biaId) {
      continue;
    }
    biaByStore.set(storeId, biaId);
  }

  const voucherRowsByPool = new Map<string, Address[]>();
  for (const pair of voucherPairs) {
    const key = pair.poolAddress.toLowerCase();
    const bucket = voucherRowsByPool.get(key) ?? [];
    bucket.push(pair.tokenAddress);
    voucherRowsByPool.set(key, dedupeAddresses(bucket));
  }

  const merchantCreditRows: Array<Record<string, unknown>> = [];
  const onchainParamCache = new Map<
    string,
    {
      creditLimit: string | null;
      requiredLiquidityAbsolute: string | null;
      requiredLiquidityRatio: string | null;
      sourceMode: "contract_field" | "derived_supply";
    }
  >();

  for (const merchant of merchantRows ?? []) {
    const storeId = Number(merchant.store_id);
    const merchantWallet = toAddress(merchant.wallet_address);
    if (!Number.isFinite(storeId) || !merchantWallet) {
      continue;
    }

    const biaId = biaByStore.get(storeId);
    if (!biaId) {
      continue;
    }

    const poolAddress = poolByBia.get(biaId);
    if (!poolAddress) {
      continue;
    }

    const tokens = voucherRowsByPool.get(poolAddress) ?? [];
    for (const tokenAddress of tokens) {
      const key = `${merchantWallet.toLowerCase()}:${tokenAddress.toLowerCase()}`;
      const rawIssued = voucherActivity.balances.get(key) ?? BIGINT_ZERO;
      const metadata = metadataByToken.get(tokenAddress.toLowerCase());
      const decimals = metadata?.token_decimals ?? 18;
      const issued = rawIssued > BIGINT_ZERO ? rawIssued : BIGINT_ZERO;
      const limiterAddress = limiterByPool.get(poolAddress);
      const onchainParamKey = `${poolAddress}:${tokenAddress.toLowerCase()}`;

      let onchainParams = onchainParamCache.get(onchainParamKey);
      if (!onchainParams) {
        onchainParams = await readOnchainCreditParameters({
          client: options.client,
          poolAddress: getAddress(poolAddress),
          limiterAddress,
          tokenAddress,
          decimals,
        });
        onchainParamCache.set(onchainParamKey, onchainParams);
      }

      merchantCreditRows.push({
        scope_key: options.scopeKey,
        chain_id: options.chainId,
        merchant_wallet: merchantWallet,
        token_address: tokenAddress,
        pool_address: poolAddress,
        credit_limit: onchainParams.creditLimit,
        required_liquidity_absolute: onchainParams.requiredLiquidityAbsolute,
        required_liquidity_ratio: onchainParams.requiredLiquidityRatio,
        credit_issued: toDecimalString(issued, decimals),
        credit_remaining: null,
        source_mode: onchainParams.sourceMode,
        updated_at: nowIso,
      });
    }
  }

  const { error: clearCreditRowsError } = await options.supabase
    .schema("indexer")
    .from("merchant_credit_state")
    .delete()
    .eq("scope_key", options.scopeKey)
    .eq("chain_id", options.chainId);

  if (clearCreditRowsError) {
    throw new Error(`Failed to clear merchant credit rows: ${clearCreditRowsError.message}`);
  }

  if (merchantCreditRows.length > 0) {
    const { error: upsertCreditRowsError } = await options.supabase
      .schema("indexer")
      .from("merchant_credit_state")
      .upsert(merchantCreditRows, {
        onConflict: "scope_key,chain_id,merchant_wallet,token_address,pool_address",
      });

    if (upsertCreditRowsError) {
      throw new Error(`Failed to upsert merchant credit rows: ${upsertCreditRowsError.message}`);
    }
  }

  const walletsWithVoucherBalances = new Set(
    voucherBalanceRows.map((row) => String(row.wallet_address).toLowerCase())
  );

  return {
    trackedVoucherTokens: voucherPairs.length,
    walletsWithVoucherBalances: walletsWithVoucherBalances.size,
    merchantCreditRows: merchantCreditRows.length,
    lastVoucherBlock: voucherActivity.maxBlock > 0 ? voucherActivity.maxBlock : null,
  };
}
