import { createPublicClient, createWalletClient, formatUnits, getAddress, http, isAddress, type Address } from "npm:viem@2.23.3";
import { privateKeyToAccount } from "npm:viem@2.23.3/accounts";
import { utils as ethersUtils } from "npm:ethers@5.7.2";
import { assertAdminOrOperator, userHasAnyRole } from "./rbac.ts";

const FALLBACK_TCOIN_ADDRESS = "0x298a698031e2fd7d8f0c830f3fd887601b40058c";

type OnrampSessionStatus =
  | "created"
  | "widget_opened"
  | "payment_submitted"
  | "crypto_sent"
  | "usdc_received"
  | "mint_started"
  | "mint_complete"
  | "failed"
  | "manual_review";

type OnrampAttemptMode = "auto" | "manual_operator";

type OnrampCheckoutSessionRow = {
  id: string;
  user_id: number;
  app_instance_id: number;
  city_slug: string;
  provider: "transak";
  provider_session_id: string | null;
  provider_order_id: string | null;
  fiat_currency: string;
  fiat_amount: string | number;
  country_code: string | null;
  target_chain_id: number;
  target_input_asset: string;
  final_asset: string;
  deposit_address: string;
  recipient_wallet: string;
  status: OnrampSessionStatus;
  status_reason: string | null;
  incoming_usdc_tx_hash: string | null;
  mint_tx_hash: string | null;
  tcoin_delivery_tx_hash: string | null;
  usdc_received_amount: string | number | null;
  tcoin_out_amount: string | number | null;
  requested_charity_id: number | null;
  quote_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type OnrampConfig = {
  transakApiKey: string;
  transakAccessToken: string;
  transakAuthorizationToken: string | null;
  transakWidgetApiUrl: string;
  targetChainId: number;
  targetInputAsset: string;
  finalAsset: string;
  settlementTimeoutSeconds: number;
  maxAutoAttempts: number;
  maxManualAttempts: number;
  slippageBps: number;
  deadlineSeconds: number;
  hdMasterSeed: string;
  hdDerivationPathBase: string;
  gasBankPrivateKey: `0x${string}`;
  gasTopupMinWei: bigint;
  gasTopupTargetWei: bigint;
  usdcTokenAddress: Address;
  routerAddress: Address;
  swapAdapterId: string;
  appBaseUrl: string;
  rpcUrl: string;
  defaultSwapData: `0x${string}`;
};

type DerivedWallet = {
  index: number;
  address: Address;
  privateKey: `0x${string}`;
};

const erc20ReadWriteAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const tcoinMintRouterAbi = [
  {
    type: "function",
    name: "previewMintTcoinWithToken",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "requestedCharityId", type: "uint256" },
      { name: "swapData", type: "bytes" },
    ],
    outputs: [
      { name: "cadmOut", type: "uint256" },
      { name: "tcoinOut", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "mintTcoinWithUSDC",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usdcAmountIn", type: "uint256" },
      { name: "minCadmOut", type: "uint256" },
      { name: "minTcoinOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "requestedCharityId", type: "uint256" },
      { name: "swapData", type: "bytes" },
    ],
    outputs: [{ name: "tcoinOut", type: "uint256" }],
  },
] as const;

function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? fallback;
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function optionalEnv(name: string, fallback?: string): string | null {
  const value = Deno.env.get(name) ?? fallback;
  if (!value || value.trim() === "") {
    return null;
  }
  return value.trim();
}

function integerEnv(name: string, fallback: number): number {
  const value = optionalEnv(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

function bigintEnv(name: string, fallback: bigint): bigint {
  const value = optionalEnv(name);
  if (!value) {
    return fallback;
  }
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${name} must be a bigint-compatible integer string.`);
  }
}

function addressEnv(name: string): Address {
  const value = env(name);
  if (!isAddress(value)) {
    throw new Error(`${name} must be a valid 0x address.`);
  }
  return getAddress(value);
}

function normalizeHexBytes(value: string): `0x${string}` {
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(normalized)) {
    throw new Error(`Invalid hex bytes value: ${value}`);
  }
  return normalized as `0x${string}`;
}

function getOnrampConfig(): OnrampConfig {
  const rawGasPrivateKey = env("ONRAMP_GAS_BANK_PRIVATE_KEY");
  const gasBankPrivateKey = normalizeHexBytes(rawGasPrivateKey);
  if (!/^0x[0-9a-f]{64}$/.test(gasBankPrivateKey)) {
    throw new Error("ONRAMP_GAS_BANK_PRIVATE_KEY must be a 32-byte hex private key.");
  }

  return {
    transakApiKey: env("ONRAMP_TRANSAK_API_KEY"),
    transakAccessToken: env("ONRAMP_TRANSAK_ACCESS_TOKEN"),
    transakAuthorizationToken: optionalEnv("ONRAMP_TRANSAK_USER_AUTH_TOKEN"),
    transakWidgetApiUrl: env(
      "ONRAMP_TRANSAK_WIDGET_API_URL",
      "https://api-gateway-stg.transak.com/api/v2/auth/session"
    ),
    targetChainId: integerEnv("ONRAMP_TARGET_CHAIN_ID", 42220),
    targetInputAsset: env("ONRAMP_TARGET_INPUT_ASSET", "USDC"),
    finalAsset: env("ONRAMP_FINAL_ASSET", "TCOIN"),
    settlementTimeoutSeconds: Math.max(60, integerEnv("ONRAMP_SETTLEMENT_TIMEOUT_SECONDS", 600)),
    maxAutoAttempts: Math.max(1, integerEnv("ONRAMP_MAX_AUTO_ATTEMPTS", 3)),
    maxManualAttempts: Math.max(1, integerEnv("ONRAMP_MAX_MANUAL_ATTEMPTS", 3)),
    slippageBps: Math.max(1, Math.min(5_000, integerEnv("ONRAMP_SLIPPAGE_BPS", 100))),
    deadlineSeconds: Math.max(60, integerEnv("ONRAMP_DEADLINE_SECONDS", 900)),
    hdMasterSeed: env("ONRAMP_HD_MASTER_SEED"),
    hdDerivationPathBase: env("ONRAMP_HD_DERIVATION_PATH_BASE", "m/44'/52752'/0'/0"),
    gasBankPrivateKey,
    gasTopupMinWei: bigintEnv("ONRAMP_GAS_TOPUP_MIN_WEI", BigInt("1000000000000000")),
    gasTopupTargetWei: bigintEnv("ONRAMP_GAS_TOPUP_TARGET_WEI", BigInt("5000000000000000")),
    usdcTokenAddress: addressEnv("ONRAMP_USDC_TOKEN_ADDRESS"),
    routerAddress: addressEnv("ONRAMP_ROUTER_ADDRESS"),
    swapAdapterId: env("ONRAMP_SWAP_ADAPTER_ID", "default"),
    appBaseUrl: env("ONRAMP_APP_BASE_URL", "http://localhost:3000"),
    rpcUrl: env("INDEXER_CHAIN_RPC_URL", "https://forno.celo.org"),
    defaultSwapData: normalizeHexBytes(optionalEnv("ONRAMP_SWAP_DATA_HEX", "0x") ?? "0x"),
  };
}

export function isBuyTcoinCheckoutEnabled(): boolean {
  return (optionalEnv("NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1", "false") ?? "false").toLowerCase() === "true";
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

function toNullableStringNumber(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") {
    return "CAD";
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" ? "CAD" : trimmed;
}

function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" ? null : trimmed;
}

function looksLikeMnemonic(value: string): boolean {
  return value.trim().split(/\s+/).length >= 12;
}

function normalizeSeedHex(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]+$/.test(prefixed)) {
    throw new Error("ONRAMP_HD_MASTER_SEED must be either a mnemonic or a hex seed.");
  }
  return prefixed as `0x${string}`;
}

function resolveHdRoot(seedOrMnemonic: string) {
  if (looksLikeMnemonic(seedOrMnemonic)) {
    return ethersUtils.HDNode.fromMnemonic(seedOrMnemonic.trim());
  }

  const seedHex = normalizeSeedHex(seedOrMnemonic);
  return ethersUtils.HDNode.fromSeed(ethersUtils.arrayify(seedHex));
}

function deriveWalletAtIndex(index: number): DerivedWallet {
  if (!Number.isFinite(index) || index < 0) {
    throw new Error("Invalid derivation index.");
  }

  const config = getOnrampConfig();
  const root = resolveHdRoot(config.hdMasterSeed);
  const path = `${config.hdDerivationPathBase}/${Math.trunc(index)}`;
  const child = root.derivePath(path);

  if (!child.privateKey) {
    throw new Error(`Unable to derive private key for path ${path}`);
  }

  return {
    index: Math.trunc(index),
    address: getAddress(child.address),
    privateKey: child.privateKey.toLowerCase() as `0x${string}`,
  };
}

async function getOrCreateDepositWallet(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  citySlug: string;
  chainId: number;
}) {
  const existingResult = await options.supabase
    .from("onramp_deposit_wallets")
    .select("id,address,derivation_index,status")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .eq("chain_id", options.chainId)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(`Failed to load onramp deposit wallet: ${existingResult.error.message}`);
  }

  if (existingResult.data) {
    const index = Number(existingResult.data.derivation_index);
    const wallet = deriveWalletAtIndex(index);

    if (wallet.address.toLowerCase() !== String(existingResult.data.address).toLowerCase()) {
      throw new Error("Derived wallet address mismatch for stored onramp deposit wallet.");
    }

    if (existingResult.data.status !== "active") {
      throw new Error("Onramp deposit wallet is not active for this user.");
    }

    return {
      wallet,
      created: false,
      rowId: String(existingResult.data.id),
    };
  }

  const derivationIndex = Math.max(1, Math.trunc(options.userId));
  const wallet = deriveWalletAtIndex(derivationIndex);
  const nowIso = new Date().toISOString();

  const insertResult = await options.supabase
    .from("onramp_deposit_wallets")
    .insert({
      user_id: options.userId,
      app_instance_id: options.appInstanceId,
      city_slug: options.citySlug,
      chain_id: options.chainId,
      address: wallet.address,
      derivation_index: derivationIndex,
      status: "active",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id,address,derivation_index")
    .maybeSingle();

  if (insertResult.error) {
    const raceRead = await options.supabase
      .from("onramp_deposit_wallets")
      .select("id,address,derivation_index,status")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .eq("chain_id", options.chainId)
      .limit(1)
      .maybeSingle();

    if (raceRead.error || !raceRead.data) {
      throw new Error(`Failed to create onramp deposit wallet: ${insertResult.error.message}`);
    }

    const raceIndex = Number(raceRead.data.derivation_index);
    const raceWallet = deriveWalletAtIndex(raceIndex);
    return {
      wallet: raceWallet,
      created: false,
      rowId: String(raceRead.data.id),
    };
  }

  if (!insertResult.data?.id) {
    throw new Error("Failed to create onramp deposit wallet.");
  }

  return {
    wallet,
    created: true,
    rowId: String(insertResult.data.id),
  };
}

const TIMELINE_ORDER: OnrampSessionStatus[] = [
  "created",
  "widget_opened",
  "payment_submitted",
  "crypto_sent",
  "usdc_received",
  "mint_started",
  "mint_complete",
];

const STEP_LABELS: Record<OnrampSessionStatus, string> = {
  created: "Session created",
  widget_opened: "Checkout opened",
  payment_submitted: "Payment submitted",
  crypto_sent: "USDC transfer initiated",
  usdc_received: "USDC received",
  mint_started: "Mint in progress",
  mint_complete: "TCOIN delivered",
  failed: "Failed",
  manual_review: "Manual review",
};

function buildOnrampTimeline(status: OnrampSessionStatus) {
  const currentIndex = TIMELINE_ORDER.indexOf(status);
  return TIMELINE_ORDER.map((key, index) => ({
    key,
    label: STEP_LABELS[key],
    reached: currentIndex >= index,
    active: key === status,
  }));
}

function projectOnrampStatus(session: OnrampCheckoutSessionRow) {
  return {
    id: session.id,
    status: session.status,
    statusReason: session.status_reason,
    provider: session.provider,
    fiatCurrency: session.fiat_currency,
    fiatAmount: String(session.fiat_amount),
    inputAsset: session.target_input_asset,
    finalAsset: session.final_asset,
    depositAddress: session.deposit_address,
    recipientWallet: session.recipient_wallet,
    incomingUsdcTxHash: session.incoming_usdc_tx_hash,
    mintTxHash: session.mint_tx_hash,
    tcoinDeliveryTxHash: session.tcoin_delivery_tx_hash,
    usdcReceivedAmount: toNullableStringNumber(session.usdc_received_amount),
    tcoinOutAmount: toNullableStringNumber(session.tcoin_out_amount),
    timeline: buildOnrampTimeline(session.status),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function classifySessionError(message: string): {
  state: "needs_wallet" | "misconfigured";
  reason: "wallet_not_ready" | "provider_config" | "session_create_failed";
  message: string;
} {
  if (message === "Unauthorized") {
    return {
      state: "misconfigured",
      reason: "session_create_failed",
      message: "Your session expired. Please sign in again and retry.",
    };
  }

  if (message.startsWith("No EVM wallet")) {
    return {
      state: "needs_wallet",
      reason: "wallet_not_ready",
      message: "Finish wallet setup before starting Buy TCOIN checkout.",
    };
  }

  const lower = message.toLowerCase();
  if (
    lower.includes("invalid hex bytes value") ||
    lower.includes("private key") ||
    lower.includes("onramp_") ||
    lower.includes("must be a valid 0x address")
  ) {
    return {
      state: "misconfigured",
      reason: "provider_config",
      message: "Buy TCOIN checkout is temporarily unavailable due to provider configuration.",
    };
  }

  return {
    state: "misconfigured",
    reason: "session_create_failed",
    message: "Could not create checkout session right now. Please try again shortly.",
  };
}

function isReadModelMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("could not find the function") ||
    lower.includes("could not find a relationship")
  );
}

function resolveReferrerDomain(appBaseUrl: string): string {
  try {
    return new URL(appBaseUrl).host;
  } catch {
    return "localhost";
  }
}

async function buildTransakSession(input: {
  sessionId: string;
  userId: number;
  fiatAmount: number;
  fiatCurrency: string;
  countryCode?: string | null;
  depositAddress: `0x${string}`;
}) {
  const config = getOnrampConfig();
  const providerSessionId = input.sessionId;
  const providerOrderId = `genero-${input.sessionId}`;
  const widgetParams: Record<string, unknown> = {
    apiKey: config.transakApiKey,
    defaultNetwork: "celo",
    defaultCryptoCurrency: config.targetInputAsset,
    cryptoCurrencyCode: config.targetInputAsset,
    network: "celo",
    walletAddress: input.depositAddress,
    disableWalletAddressForm: true,
    disableCryptoSelection: true,
    fiatAmount: input.fiatAmount,
    fiatCurrency: input.fiatCurrency.toUpperCase(),
    countryCode: (input.countryCode ?? "").toUpperCase(),
    redirectURL: `${config.appBaseUrl.replace(/\/$/, "")}/dashboard?onrampSession=${input.sessionId}`,
    partnerOrderId: providerOrderId,
    partnerCustomerId: String(input.userId),
    exchangeScreenTitle: "Buy TCOIN",
    isAutoFillUserData: true,
  };

  const response = await fetch(config.transakWidgetApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "access-token": config.transakAccessToken,
      ...(config.transakAuthorizationToken ? { authorization: config.transakAuthorizationToken } : {}),
    },
    body: JSON.stringify({
      widgetParams,
      referrerDomain: resolveReferrerDomain(config.appBaseUrl),
    }),
  });

  const responsePayload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const errorMessage =
      (typeof responsePayload.message === "string" && responsePayload.message) ||
      (typeof responsePayload.error === "string" && responsePayload.error) ||
      `Transak widget URL request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const directWidgetUrl =
    typeof responsePayload.widgetUrl === "string"
      ? responsePayload.widgetUrl
      : responsePayload.data && typeof responsePayload.data === "object" && typeof (responsePayload.data as Record<string, unknown>).widgetUrl === "string"
        ? String((responsePayload.data as Record<string, unknown>).widgetUrl)
        : null;

  if (!directWidgetUrl) {
    throw new Error("Transak widget API response did not include widgetUrl.");
  }

  return {
    provider: "transak" as const,
    providerSessionId,
    providerOrderId,
    widgetUrl: directWidgetUrl,
    widgetConfig: {
      widgetParams,
      referrerDomain: resolveReferrerDomain(config.appBaseUrl),
    },
  };
}

async function resolveUserRecipientWallet(supabase: any, userId: number): Promise<`0x${string}`> {
  const { data, error } = await supabase
    .from("v_wallet_identities_v1")
    .select("public_key,wallet_ready")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve recipient wallet: ${error.message}`);
  }

  if (data?.wallet_ready === true && data?.public_key && isAddress(data.public_key)) {
    return getAddress(data.public_key) as `0x${string}`;
  }

  throw new Error("No EVM wallet found for this user. Connect wallet before using Buy TCOIN.");
}

function isTerminal(status: OnrampSessionStatus): boolean {
  return status === "mint_complete" || status === "failed";
}

async function resolveSession(options: { supabase: any; sessionId: string }) {
  const { data, error } = await options.supabase
    .from("onramp_checkout_sessions")
    .select("*")
    .eq("id", options.sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load onramp session: ${error.message}`);
  }

  if (!data) {
    throw new Error("Onramp session not found.");
  }

  return data as OnrampCheckoutSessionRow;
}

async function updateSession(options: { supabase: any; sessionId: string; patch: Record<string, unknown> }) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase
    .from("onramp_checkout_sessions")
    .update({
      ...options.patch,
      updated_at: nowIso,
    })
    .eq("id", options.sessionId);

  if (error) {
    throw new Error(`Failed to update onramp session: ${error.message}`);
  }
}

async function nextAttemptNo(options: { supabase: any; sessionId: string }): Promise<number> {
  const { data, error } = await options.supabase
    .from("onramp_settlement_attempts")
    .select("attempt_no")
    .eq("session_id", options.sessionId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read settlement attempts: ${error.message}`);
  }

  return Number(data?.attempt_no ?? 0) + 1;
}

async function insertAttempt(options: {
  supabase: any;
  sessionId: string;
  attemptNo: number;
  mode: OnrampAttemptMode;
  state: "started" | "succeeded" | "failed";
  errorMessage?: string | null;
  mintTxHash?: string | null;
  routerAddress?: string;
  routerCallPayload?: Record<string, unknown>;
  minCadmOut?: string;
  minTcoinOut?: string;
  deadlineUnix?: number;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase.from("onramp_settlement_attempts").insert({
    session_id: options.sessionId,
    attempt_no: options.attemptNo,
    mode: options.mode,
    state: options.state,
    error_message: options.errorMessage ?? null,
    mint_tx_hash: options.mintTxHash ?? null,
    router_address: options.routerAddress ?? null,
    router_call_payload: options.routerCallPayload ?? {},
    min_cadm_out: options.minCadmOut ?? null,
    min_tcoin_out: options.minTcoinOut ?? null,
    deadline_unix: options.deadlineUnix ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) {
    throw new Error(`Failed to persist settlement attempt: ${error.message}`);
  }
}

async function updateAttempt(options: {
  supabase: any;
  sessionId: string;
  attemptNo: number;
  patch: Record<string, unknown>;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase
    .from("onramp_settlement_attempts")
    .update({
      ...options.patch,
      updated_at: nowIso,
    })
    .eq("session_id", options.sessionId)
    .eq("attempt_no", options.attemptNo);

  if (error) {
    throw new Error(`Failed to update settlement attempt: ${error.message}`);
  }
}

async function tryAcquireLock(options: {
  supabase: any;
  sessionId: string;
  owner: string;
}) {
  const { data, error } = await options.supabase.rpc("onramp_try_acquire_lock", {
    p_session_id: options.sessionId,
    p_lock_owner: options.owner,
    p_ttl_seconds: 120,
  });

  if (error) {
    throw new Error(`Failed to acquire onramp lock: ${error.message}`);
  }

  return Boolean(data);
}

async function releaseLock(options: {
  supabase: any;
  sessionId: string;
  owner: string;
}) {
  await options.supabase.rpc("onramp_release_lock", {
    p_session_id: options.sessionId,
    p_lock_owner: options.owner,
  });
}

async function resolveRequestedCharityId(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const { data, error } = await options.supabase
    .from("app_user_profiles")
    .select("charity_preferences")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.charity_preferences !== "object" || !data.charity_preferences) {
    return 0;
  }

  const prefs = data.charity_preferences as Record<string, unknown>;
  const candidate = prefs.charityId ?? prefs.charity_id ?? prefs.selectedCauseId ?? prefs.selected_cause_id;
  const parsed = toNumber(candidate, 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

async function ensureDepositWalletGas(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  gasBankWalletClient: ReturnType<typeof createWalletClient>;
  depositAddress: Address;
}) {
  const config = getOnrampConfig();
  const currentBalance = await options.publicClient.getBalance({ address: options.depositAddress });
  if (currentBalance >= config.gasTopupMinWei) {
    return;
  }

  const transferAmount =
    config.gasTopupTargetWei > currentBalance
      ? config.gasTopupTargetWei - currentBalance
      : config.gasTopupMinWei;

  const hash = await options.gasBankWalletClient.sendTransaction({
    to: options.depositAddress,
    value: transferAmount,
  } as never);

  await options.publicClient.waitForTransactionReceipt({ hash });
}

async function resolveActiveUserBia(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const { data, error } = await options.supabase
    .from("user_bia_affiliations")
    .select("bia_id")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user BIA affiliation: ${error.message}`);
  }

  return data?.bia_id ?? null;
}

async function resolveActiveBiaPoolMapping(options: { supabase: any; biaId: string; chainId: number }) {
  const { data, error } = await options.supabase
    .from("bia_pool_mappings")
    .select("*")
    .eq("bia_id", options.biaId)
    .eq("chain_id", options.chainId)
    .eq("mapping_status", "active")
    .is("effective_to", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve BIA pool mapping: ${error.message}`);
  }

  return data;
}

async function resolveTcoinAddress(options: { supabase: any; citySlug: string; chainId: number }): Promise<Address> {
  const { data, error } = await options.supabase
    .schema("indexer")
    .from("city_contract_overrides")
    .select("tcoin_address")
    .eq("city_slug", options.citySlug)
    .eq("chain_id", options.chainId)
    .limit(1)
    .maybeSingle();

  if (!error && data?.tcoin_address && isAddress(data.tcoin_address)) {
    return getAddress(data.tcoin_address);
  }

  if (options.citySlug === "tcoin" && options.chainId === 42220) {
    return getAddress(FALLBACK_TCOIN_ADDRESS);
  }

  throw new Error(`No TCOIN contract address found for city '${options.citySlug}' on chain ${options.chainId}.`);
}

async function insertPoolPurchaseAttribution(options: {
  supabase: any;
  session: OnrampCheckoutSessionRow;
  chainId: number;
  tcoinAddress: Address;
  mintTxHash: string;
  tokenOutAmount: string;
}) {
  try {
    const activeBia = await resolveActiveUserBia({
      supabase: options.supabase,
      userId: Number(options.session.user_id),
      appInstanceId: Number(options.session.app_instance_id),
    });

    if (!activeBia) {
      return;
    }

    const mapping = await resolveActiveBiaPoolMapping({
      supabase: options.supabase,
      biaId: activeBia,
      chainId: options.chainId,
    });

    if (!mapping?.pool_address) {
      return;
    }

    const nowIso = new Date().toISOString();
    await options.supabase.from("pool_purchase_requests").insert({
      user_id: options.session.user_id,
      app_instance_id: options.session.app_instance_id,
      bia_id: activeBia,
      chain_id: options.chainId,
      pool_address: mapping.pool_address,
      token_address: options.tcoinAddress,
      fiat_amount: options.session.fiat_amount,
      token_amount: options.tokenOutAmount,
      tx_hash: options.mintTxHash,
      status: "confirmed",
      metadata: {
        execution_mode: "onramp_checkout",
        session_id: options.session.id,
        provider: options.session.provider,
      },
      created_at: nowIso,
      updated_at: nowIso,
    });
  } catch {
    // Attribution is best-effort only.
  }
}

function validateSessionAddresses(session: OnrampCheckoutSessionRow): {
  depositAddress: Address;
  recipientWallet: Address;
} {
  if (!isAddress(session.deposit_address)) {
    throw new Error("Invalid deposit wallet address stored on session.");
  }

  if (!isAddress(session.recipient_wallet)) {
    throw new Error("Invalid recipient wallet address stored on session.");
  }

  return {
    depositAddress: getAddress(session.deposit_address),
    recipientWallet: getAddress(session.recipient_wallet),
  };
}

async function countAttemptsByMode(options: {
  supabase: any;
  sessionId: string;
  mode: OnrampAttemptMode;
}) {
  const { count, error } = await options.supabase
    .from("onramp_settlement_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", options.sessionId)
    .eq("mode", options.mode);

  if (error) {
    throw new Error(`Failed to count settlement attempts: ${error.message}`);
  }

  return Number(count ?? 0);
}

function clampMin(value: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(9_999, slippageBps)));
  return (value * (BigInt(10_000) - bps)) / BigInt(10_000);
}

export async function createOnrampSession(options: {
  supabase: any;
  userId: number;
  citySlug: string;
  appInstanceId: number;
  fiatAmount: number;
  fiatCurrency?: string;
  countryCode?: string | null;
}) {
  if (!isBuyTcoinCheckoutEnabled()) {
    return {
      status: 200,
      body: {
        state: "disabled",
        reason: "feature_disabled",
        message: "Buy TCOIN checkout is currently unavailable.",
        fallback: "Use Top Up with Interac eTransfer.",
      },
    };
  }

  const config = getOnrampConfig();
  if (!(options.fiatAmount > 0)) {
    return {
      status: 400,
      body: { error: "fiatAmount must be a positive number." },
    };
  }

  try {
    const fiatCurrency = normalizeCurrency(options.fiatCurrency);
    const countryCode = normalizeCountryCode(options.countryCode);
    const recipientWallet = await resolveUserRecipientWallet(options.supabase, options.userId);

    const deposit = await getOrCreateDepositWallet({
      supabase: options.supabase,
      userId: options.userId,
      appInstanceId: options.appInstanceId,
      citySlug: options.citySlug,
      chainId: config.targetChainId,
    });

    const nowIso = new Date().toISOString();

    const insertedResult = await options.supabase
      .from("onramp_checkout_sessions")
      .insert({
        user_id: options.userId,
        app_instance_id: options.appInstanceId,
        city_slug: options.citySlug,
        provider: "transak",
        fiat_currency: fiatCurrency,
        fiat_amount: options.fiatAmount,
        country_code: countryCode,
        target_chain_id: config.targetChainId,
        target_input_asset: config.targetInputAsset,
        final_asset: config.finalAsset,
        deposit_address: deposit.wallet.address,
        recipient_wallet: recipientWallet,
        status: "created",
        metadata: {
          source: "wallet_buy_tcoin",
          depositWalletCreated: deposit.created,
          swapAdapterId: config.swapAdapterId,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (insertedResult.error || !insertedResult.data) {
      throw new Error(`Failed to create onramp checkout session: ${insertedResult.error?.message ?? "unknown"}`);
    }

    const session = insertedResult.data as OnrampCheckoutSessionRow;
    const transak = await buildTransakSession({
      sessionId: session.id,
      userId: options.userId,
      fiatAmount: options.fiatAmount,
      fiatCurrency,
      countryCode,
      depositAddress: deposit.wallet.address,
    });

    const updateResult = await options.supabase
      .from("onramp_checkout_sessions")
      .update({
        provider_session_id: transak.providerSessionId,
        provider_order_id: transak.providerOrderId,
        metadata: {
          ...(session.metadata ?? {}),
          widgetUrl: transak.widgetUrl,
        },
        updated_at: nowIso,
      })
      .eq("id", session.id);

    if (updateResult.error) {
      throw new Error(`Failed to finalize onramp checkout session: ${updateResult.error.message}`);
    }

    await options.supabase.from("governance_actions_log").insert({
      action_type: "onramp_checkout_session_created",
      city_slug: options.citySlug,
      actor_user_id: options.userId,
      reason: "User initiated Buy TCOIN checkout session",
      payload: {
        sessionId: session.id,
        provider: "transak",
        fiatAmount: options.fiatAmount,
        fiatCurrency,
        countryCode,
        depositAddress: deposit.wallet.address,
        recipientWallet,
      },
    });

    return {
      status: 200,
      body: {
        state: "ready",
        sessionId: session.id,
        provider: "transak",
        status: "created",
        depositAddress: deposit.wallet.address,
        recipientWallet,
        widgetUrl: transak.widgetUrl,
        widgetConfig: transak.widgetConfig,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp session error";
    const classified = classifySessionError(message);
    const includeTechnicalError = ["local", "development"].includes(
      (optionalEnv("NEXT_PUBLIC_APP_ENVIRONMENT", "") ?? "").toLowerCase()
    );

    return {
      status: 200,
      body: {
        state: classified.state,
        reason: classified.reason,
        message: classified.message,
        technicalError: classified.state === "misconfigured" && includeTechnicalError ? message : undefined,
        fallback: "Use Top Up with Interac eTransfer.",
      },
    };
  }
}

export async function getOnrampSessionStatus(options: {
  supabase: any;
  userId: number;
  sessionId: string;
  citySlug: string;
  appInstanceId: number;
}) {
  const sessionResult = await options.supabase
    .from("onramp_checkout_sessions")
    .select("*")
    .eq("id", options.sessionId)
    .eq("city_slug", options.citySlug)
    .eq("app_instance_id", options.appInstanceId)
    .maybeSingle();

  if (sessionResult.error) {
    throw new Error(`Failed to load onramp checkout session: ${sessionResult.error.message}`);
  }

  if (!sessionResult.data) {
    return { status: 404, body: { error: "Onramp session not found." } };
  }

  const session = sessionResult.data as OnrampCheckoutSessionRow;
  const isPrivileged = await userHasAnyRole({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    roles: ["admin", "operator"],
  });

  if (!isPrivileged && Number(session.user_id) !== Number(options.userId)) {
    return { status: 403, body: { error: "Forbidden: this session does not belong to current user." } };
  }

  return {
    status: 200,
    body: {
      session: projectOnrampStatus(session),
    },
  };
}

export async function markOnrampSessionAction(options: {
  supabase: any;
  userId: number;
  sessionId: string;
  citySlug: string;
  appInstanceId: number;
  action?: string;
}) {
  const sessionResult = await options.supabase
    .from("onramp_checkout_sessions")
    .select("id,user_id,status")
    .eq("id", options.sessionId)
    .eq("city_slug", options.citySlug)
    .eq("app_instance_id", options.appInstanceId)
    .maybeSingle();

  if (sessionResult.error) {
    throw new Error(`Failed to load onramp checkout session: ${sessionResult.error.message}`);
  }
  if (!sessionResult.data) {
    return { status: 404, body: { error: "Onramp session not found." } };
  }

  const isPrivileged = await userHasAnyRole({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    roles: ["admin", "operator"],
  });

  if (!isPrivileged && Number(sessionResult.data.user_id) !== Number(options.userId)) {
    return { status: 403, body: { error: "Forbidden: this session does not belong to current user." } };
  }

  if (options.action === "widget_opened" && sessionResult.data.status === "created") {
    const { error: updateError } = await options.supabase
      .from("onramp_checkout_sessions")
      .update({
        status: "widget_opened",
        updated_at: new Date().toISOString(),
      })
      .eq("id", options.sessionId);

    if (updateError) {
      throw new Error(`Failed to update onramp session action: ${updateError.message}`);
    }
  }

  const refreshedResult = await options.supabase
    .from("onramp_checkout_sessions")
    .select("*")
    .eq("id", options.sessionId)
    .maybeSingle();

  if (refreshedResult.error || !refreshedResult.data) {
    throw new Error(`Failed to refresh onramp session: ${refreshedResult.error?.message ?? "not found"}`);
  }

  return {
    status: 200,
    body: {
      session: projectOnrampStatus(refreshedResult.data as OnrampCheckoutSessionRow),
    },
  };
}

export async function listOnrampAdminSessions(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  citySlug: string;
  limit?: number;
  status?: string | null;
  targetUserId?: number | null;
}) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
  });

  let query = options.supabase
    .from("v_onramp_checkout_admin")
    .select("*")
    .eq("city_slug", options.citySlug)
    .eq("app_instance_id", options.appInstanceId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, Math.trunc(options.limit ?? 50))));

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.targetUserId && Number.isFinite(options.targetUserId) && options.targetUserId > 0) {
    query = query.eq("user_id", options.targetUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load onramp admin sessions: ${error.message}`);
  }

  return {
    status: 200,
    body: {
      citySlug: options.citySlug,
      appInstanceId: options.appInstanceId,
      sessions: (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: Number(row.user_id),
        provider: String(row.provider ?? "transak"),
        fiatAmount: String(row.fiat_amount ?? "0"),
        fiatCurrency: String(row.fiat_currency ?? "CAD"),
        status: String(row.status ?? "created"),
        statusReason: typeof row.status_reason === "string" ? row.status_reason : null,
        depositAddress: String(row.deposit_address ?? ""),
        recipientWallet: String(row.recipient_wallet ?? ""),
        incomingUsdcTxHash: typeof row.incoming_usdc_tx_hash === "string" ? row.incoming_usdc_tx_hash : null,
        mintTxHash: typeof row.mint_tx_hash === "string" ? row.mint_tx_hash : null,
        tcoinOutAmount:
          typeof row.tcoin_out_amount === "string" || typeof row.tcoin_out_amount === "number"
            ? String(row.tcoin_out_amount)
            : null,
        latestAttemptNo: typeof row.latest_attempt_no === "number" ? row.latest_attempt_no : null,
        latestAttemptMode: typeof row.latest_attempt_mode === "string" ? row.latest_attempt_mode : null,
        latestAttemptState: typeof row.latest_attempt_state === "string" ? row.latest_attempt_state : null,
        latestAttemptError: typeof row.latest_attempt_error === "string" ? row.latest_attempt_error : null,
        createdAt: String(row.created_at ?? ""),
        updatedAt: String(row.updated_at ?? ""),
      })),
    },
  };
}

export async function listLegacyRampAdminRequests(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  citySlug: string;
}) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
  });

  const [onRampResult, offRampResult, statusResult] = await Promise.all([
    options.supabase
      .from("v_admin_interac_onramp_ops_v1")
      .select("*")
      .eq("app_instance_id", options.appInstanceId)
      .order("created_at", { ascending: false }),
    options.supabase
      .from("v_admin_manual_offramp_ops_v1")
      .select("*")
      .eq("app_instance_id", options.appInstanceId)
      .order("created_at", { ascending: false }),
    options.supabase.from("ref_request_statuses").select("status").order("status", { ascending: true }),
  ]);

  if (onRampResult.error) {
    if (isReadModelMissing(onRampResult.error.message)) {
      return {
        status: 200,
        body: {
          citySlug: options.citySlug,
          appInstanceId: options.appInstanceId,
          state: "setup_required",
          setupMessage: "Interac on-ramp operations view is not available yet for this app instance.",
          onRampRequests: [],
          offRampRequests: [],
          statuses: [],
        },
      };
    }
    throw new Error(`Failed to load legacy on-ramp requests: ${onRampResult.error.message}`);
  }
  if (offRampResult.error) {
    if (isReadModelMissing(offRampResult.error.message)) {
      return {
        status: 200,
        body: {
          citySlug: options.citySlug,
          appInstanceId: options.appInstanceId,
          state: "setup_required",
          setupMessage: "Manual off-ramp operations view is not available yet for this app instance.",
          onRampRequests: [],
          offRampRequests: [],
          statuses: [],
        },
      };
    }
    throw new Error(`Failed to load legacy off-ramp requests: ${offRampResult.error.message}`);
  }
  if (statusResult.error) {
    if (isReadModelMissing(statusResult.error.message)) {
      return {
        status: 200,
        body: {
          citySlug: options.citySlug,
          appInstanceId: options.appInstanceId,
          state: "setup_required",
          setupMessage: "Request status reference data is not configured yet for this app instance.",
          onRampRequests: [],
          offRampRequests: [],
          statuses: [],
        },
      };
    }
    throw new Error(`Failed to load legacy request statuses: ${statusResult.error.message}`);
  }

  const onRampRequests = (onRampResult.data ?? []) as Array<Record<string, unknown>>;
  const offRampRequests = (offRampResult.data ?? []) as Array<Record<string, unknown>>;

  return {
    status: 200,
    body: {
      citySlug: options.citySlug,
      appInstanceId: options.appInstanceId,
      state: onRampRequests.length === 0 && offRampRequests.length === 0 ? "empty" : "ready",
      setupMessage: null,
      onRampRequests,
      offRampRequests,
      statuses: statusResult.data ?? [],
    },
  };
}

export async function runSessionSettlement(options: {
  supabase: any;
  sessionId: string;
  mode?: OnrampAttemptMode;
  trigger?: "webhook" | "touch" | "admin";
  actorUserId?: number | null;
}) {
  const mode = options.mode ?? "auto";
  const config = getOnrampConfig();
  const lockOwner = `onramp:${mode}:${crypto.randomUUID()}`;
  let activeAttemptNo: number | null = null;

  const lockAcquired = await tryAcquireLock({
    supabase: options.supabase,
    sessionId: options.sessionId,
    owner: lockOwner,
  });

  if (!lockAcquired) {
    return {
      sessionId: options.sessionId,
      status: "mint_started" as OnrampSessionStatus,
      skipped: true,
      reason: "session_locked",
    };
  }

  try {
    const session = await resolveSession({
      supabase: options.supabase,
      sessionId: options.sessionId,
    });

    if (isTerminal(session.status)) {
      return {
        sessionId: session.id,
        status: session.status,
        skipped: true,
        reason: "terminal_status",
      };
    }

    if (mode === "auto") {
      const autoAttempts = await countAttemptsByMode({
        supabase: options.supabase,
        sessionId: session.id,
        mode: "auto",
      });

      if (autoAttempts >= config.maxAutoAttempts) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "manual_review",
            status_reason: "Reached max auto settlement attempts.",
          },
        });

        return {
          sessionId: session.id,
          status: "manual_review" as OnrampSessionStatus,
          skipped: true,
          reason: "max_auto_attempts",
        };
      }
    }

    if (mode === "manual_operator") {
      const manualAttempts = await countAttemptsByMode({
        supabase: options.supabase,
        sessionId: session.id,
        mode: "manual_operator",
      });

      if (manualAttempts >= config.maxManualAttempts) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "failed",
            status_reason: "Reached max manual settlement attempts.",
          },
        });

        return {
          sessionId: session.id,
          status: "failed" as OnrampSessionStatus,
          skipped: true,
          reason: "max_manual_attempts",
        };
      }
    }

    const createdAt = new Date(session.created_at).getTime();
    const ageSeconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.trunc((Date.now() - createdAt) / 1000))
      : 0;

    const { depositAddress, recipientWallet } = validateSessionAddresses(session);
    const publicClient = createPublicClient({ transport: http(config.rpcUrl) });

    const usdcDecimals = await publicClient.readContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "decimals",
    });

    const usdcBalance = await publicClient.readContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [depositAddress],
    });

    if (usdcBalance <= BigInt(0)) {
      if (ageSeconds >= config.settlementTimeoutSeconds) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "manual_review",
            status_reason: "USDC settlement not detected before timeout.",
          },
        });

        return {
          sessionId: session.id,
          status: "manual_review" as OnrampSessionStatus,
          skipped: true,
          reason: "usdc_timeout",
        };
      }

      return {
        sessionId: session.id,
        status: session.status,
        skipped: true,
        reason: "usdc_not_received",
      };
    }

    const usdcAmountString = formatUnits(usdcBalance, usdcDecimals);

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "usdc_received",
        usdc_received_amount: usdcAmountString,
      },
    });

    const requestedCharityId =
      typeof session.requested_charity_id === "number" && session.requested_charity_id > 0
        ? session.requested_charity_id
        : await resolveRequestedCharityId({
            supabase: options.supabase,
            userId: Number(session.user_id),
            appInstanceId: Number(session.app_instance_id),
          });

    const swapData = config.defaultSwapData;

    const [quoteCadmOut, quoteTcoinOut] = await publicClient.readContract({
      address: config.routerAddress,
      abi: tcoinMintRouterAbi,
      functionName: "previewMintTcoinWithToken",
      args: [config.usdcTokenAddress, usdcBalance, BigInt(requestedCharityId), swapData],
    });

    if (quoteCadmOut <= BigInt(0) || quoteTcoinOut <= BigInt(0)) {
      await updateSession({
        supabase: options.supabase,
        sessionId: session.id,
        patch: {
          status: "manual_review",
          status_reason: "Router preview quote returned zero output.",
        },
      });

      return {
        sessionId: session.id,
        status: "manual_review" as OnrampSessionStatus,
        skipped: true,
        reason: "zero_quote",
      };
    }

    const minCadmOut = clampMin(quoteCadmOut, config.slippageBps);
    const minTcoinOut = clampMin(quoteTcoinOut, config.slippageBps);
    const deadlineUnix = Math.trunc(Date.now() / 1000) + config.deadlineSeconds;

    const attemptNo = await nextAttemptNo({
      supabase: options.supabase,
      sessionId: session.id,
    });
    activeAttemptNo = attemptNo;

    await insertAttempt({
      supabase: options.supabase,
      sessionId: session.id,
      attemptNo,
      mode,
      state: "started",
      routerAddress: config.routerAddress,
      routerCallPayload: {
        functionName: "mintTcoinWithUSDC",
        usdcAmountIn: usdcBalance.toString(),
        requestedCharityId,
        swapAdapterId: config.swapAdapterId,
      },
      minCadmOut: minCadmOut.toString(),
      minTcoinOut: minTcoinOut.toString(),
      deadlineUnix,
    });

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "mint_started",
        status_reason: null,
        requested_charity_id: requestedCharityId > 0 ? requestedCharityId : null,
        quote_payload: {
          quoteCadmOut: quoteCadmOut.toString(),
          quoteTcoinOut: quoteTcoinOut.toString(),
          minCadmOut: minCadmOut.toString(),
          minTcoinOut: minTcoinOut.toString(),
          slippageBps: config.slippageBps,
          deadlineUnix,
        },
      },
    });

    const depositWalletRow = await options.supabase
      .from("onramp_deposit_wallets")
      .select("derivation_index")
      .eq("user_id", session.user_id)
      .eq("app_instance_id", session.app_instance_id)
      .eq("chain_id", config.targetChainId)
      .limit(1)
      .maybeSingle();

    if (depositWalletRow.error || !depositWalletRow.data) {
      throw new Error("Unable to resolve deposit wallet derivation index.");
    }

    const derivedWallet = deriveWalletAtIndex(Number(depositWalletRow.data.derivation_index));
    if (derivedWallet.address.toLowerCase() !== depositAddress.toLowerCase()) {
      throw new Error("Deposit wallet derivation mismatch.");
    }

    const depositAccount = privateKeyToAccount(derivedWallet.privateKey);
    const gasBankAccount = privateKeyToAccount(config.gasBankPrivateKey);

    const walletClient = createWalletClient({
      account: depositAccount,
      transport: http(config.rpcUrl),
    });

    const gasBankWalletClient = createWalletClient({
      account: gasBankAccount,
      transport: http(config.rpcUrl),
    });

    await ensureDepositWalletGas({
      publicClient,
      gasBankWalletClient,
      depositAddress,
    });

    const approvalHash = await walletClient.writeContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "approve",
      args: [config.routerAddress, usdcBalance],
    } as never);

    await publicClient.waitForTransactionReceipt({ hash: approvalHash });

    const tcoinAddress = await resolveTcoinAddress({
      supabase: options.supabase,
      citySlug: session.city_slug,
      chainId: config.targetChainId,
    });

    const tcoinDecimals = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "decimals",
    });

    const recipientBalanceBefore = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [recipientWallet],
    });

    const mintHash = await walletClient.writeContract({
      address: config.routerAddress,
      abi: tcoinMintRouterAbi,
      functionName: "mintTcoinWithUSDC",
      args: [
        usdcBalance,
        minCadmOut,
        minTcoinOut,
        BigInt(deadlineUnix),
        recipientWallet,
        BigInt(requestedCharityId),
        swapData,
      ],
    } as never);

    await publicClient.waitForTransactionReceipt({ hash: mintHash });

    const recipientBalanceAfter = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [recipientWallet],
    });

    const tcoinDelta = recipientBalanceAfter > recipientBalanceBefore
      ? recipientBalanceAfter - recipientBalanceBefore
      : BigInt(0);
    const tcoinOutAmount = formatUnits(tcoinDelta, tcoinDecimals);

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "mint_complete",
        status_reason: null,
        incoming_usdc_tx_hash: session.incoming_usdc_tx_hash ?? null,
        mint_tx_hash: mintHash,
        tcoin_delivery_tx_hash: mintHash,
        tcoin_out_amount: tcoinOutAmount,
        metadata: {
          ...(session.metadata ?? {}),
          settlement_trigger: options.trigger ?? "touch",
          settlement_mode: mode,
          approval_tx_hash: approvalHash,
          completed_at: new Date().toISOString(),
        },
      },
    });

    await updateAttempt({
      supabase: options.supabase,
      sessionId: session.id,
      attemptNo,
      patch: {
        state: "succeeded",
        mint_tx_hash: mintHash,
        error_message: null,
        router_address: config.routerAddress,
        router_call_payload: {
          functionName: "mintTcoinWithUSDC",
          approvalTxHash: approvalHash,
        },
        min_cadm_out: minCadmOut.toString(),
        min_tcoin_out: minTcoinOut.toString(),
        deadline_unix: deadlineUnix,
      },
    });

    await insertPoolPurchaseAttribution({
      supabase: options.supabase,
      session,
      chainId: config.targetChainId,
      tcoinAddress,
      mintTxHash: mintHash,
      tokenOutAmount: tcoinOutAmount,
    });

    await options.supabase.from("governance_actions_log").insert({
      action_type: "onramp_mint_completed",
      city_slug: session.city_slug,
      actor_user_id: options.actorUserId ?? null,
      reason: "Onramp auto-mint completed",
      payload: {
        sessionId: session.id,
        mintTxHash: mintHash,
        usdcReceivedAmount: usdcAmountString,
        tcoinOutAmount,
      },
    });

    return {
      sessionId: session.id,
      status: "mint_complete" as OnrampSessionStatus,
      skipped: false,
      mintTxHash: mintHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown onramp settlement error";
    const session = await resolveSession({
      supabase: options.supabase,
      sessionId: options.sessionId,
    });

    if (activeAttemptNo != null) {
      await updateAttempt({
        supabase: options.supabase,
        sessionId: session.id,
        attemptNo: activeAttemptNo,
        patch: {
          state: "failed",
          error_message: message,
        },
      });
    } else {
      const attemptNo = await nextAttemptNo({
        supabase: options.supabase,
        sessionId: session.id,
      });

      await insertAttempt({
        supabase: options.supabase,
        sessionId: session.id,
        attemptNo,
        mode,
        state: "failed",
        errorMessage: message,
      });
    }

    const createdAt = new Date(session.created_at).getTime();
    const ageSeconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.trunc((Date.now() - createdAt) / 1000))
      : 0;

    const nextStatus: OnrampSessionStatus =
      ageSeconds >= getOnrampConfig().settlementTimeoutSeconds ? "manual_review" : "mint_started";

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: nextStatus,
        status_reason: message,
      },
    });

    await options.supabase.from("governance_actions_log").insert({
      action_type: "onramp_settlement_failed",
      city_slug: session.city_slug,
      actor_user_id: options.actorUserId ?? null,
      reason: "Onramp settlement attempt failed",
      payload: {
        sessionId: session.id,
        mode,
        error: message,
      },
    });

    return {
      sessionId: session.id,
      status: nextStatus,
      skipped: false,
      reason: message,
    };
  } finally {
    await releaseLock({
      supabase: options.supabase,
      sessionId: options.sessionId,
      owner: lockOwner,
    });
  }
}

export async function touchOnrampSessionsForUser(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  citySlug: string;
}) {
  if (!isBuyTcoinCheckoutEnabled()) {
    return {
      status: 200,
      body: {
        scanned: 0,
        settled: 0,
        manualReview: 0,
        skipped: 0,
        disabled: true,
      },
    };
  }

  const { data, error } = await options.supabase
    .from("onramp_checkout_sessions")
    .select("id,status")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .eq("city_slug", options.citySlug)
    .in("status", ["created", "widget_opened", "payment_submitted", "crypto_sent", "usdc_received", "mint_started", "manual_review"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to load onramp touch sessions: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  let settled = 0;
  let manualReview = 0;
  let skipped = 0;

  for (const row of rows) {
    const status = String((row as Record<string, unknown>).status ?? "created") as OnrampSessionStatus;
    const mode: OnrampAttemptMode = status === "manual_review" ? "manual_operator" : "auto";
    const result = await runSessionSettlement({
      supabase: options.supabase,
      sessionId: String((row as Record<string, unknown>).id),
      mode,
      trigger: "touch",
      actorUserId: options.userId,
    });

    if (result.skipped) {
      skipped += 1;
      continue;
    }

    if (result.status === "mint_complete") {
      settled += 1;
    } else if (result.status === "manual_review") {
      manualReview += 1;
    }
  }

  return {
    status: 200,
    body: {
      scanned: rows.length,
      settled,
      manualReview,
      skipped,
    },
  };
}

export async function retryOnrampSession(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  sessionId: string;
}) {
  await assertAdminOrOperator({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
  });

  const result = await runSessionSettlement({
    supabase: options.supabase,
    sessionId: options.sessionId,
    mode: "manual_operator",
    trigger: "admin",
    actorUserId: options.userId,
  });

  return {
    status: 200,
    body: {
      sessionId: options.sessionId,
      result,
    },
  };
}
