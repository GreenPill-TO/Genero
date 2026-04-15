import type { Address } from "viem";
import {
  TORONTOCOIN_RUNTIME,
  getTorontoCoinRuntimeConfig,
} from "@shared/lib/contracts/torontocoinRuntime";

function parseString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function parseOptionalString(name: string, fallback?: string): string | null {
  const value = process.env[name] ?? fallback;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

function parseBigint(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return fallback;
  }
  try {
    return BigInt(raw.trim());
  } catch {
    throw new Error(`${name} must be a bigint-compatible integer string.`);
  }
}

function normalizeHexBytes(value: string): `0x${string}` {
  const v = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(v)) {
    throw new Error(`Invalid hex bytes value: ${value}`);
  }
  return v as `0x${string}`;
}

export type OnrampConfig = {
  provider: "transak";
  transakApiKey: string;
  transakSecret: string;
  transakWebhookSecret: string | null;
  transakWidgetApiUrl: string;
  transakAccessToken: string;
  transakAuthorizationToken: string | null;
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
  inputTokenAddress: Address;
  routerAddress: Address;
  poolRegistryAddress: Address;
  bootstrapPoolId: `0x${string}`;
  cplTcoinAddress: Address;
  cplTcoinDecimals: number;
  reserveAssetId: `0x${string}`;
  appBaseUrl: string;
  rpcUrl: string;
  buyCheckoutFlag: boolean;
};

export function resolveOnrampConfig(): OnrampConfig {
  const provider = (process.env.ONRAMP_PROVIDER ?? "transak").trim().toLowerCase();
  if (provider !== "transak") {
    throw new Error(`Unsupported ONRAMP_PROVIDER '${provider}'. Expected 'transak'.`);
  }

  const rawGasPrivateKey = parseString("ONRAMP_GAS_BANK_PRIVATE_KEY");
  const gasBankPrivateKey = normalizeHexBytes(rawGasPrivateKey);
  if (!/^0x[0-9a-f]{64}$/.test(gasBankPrivateKey)) {
    throw new Error("ONRAMP_GAS_BANK_PRIVATE_KEY must be a 32-byte hex private key.");
  }

  const targetChainId = parseInteger("ONRAMP_TARGET_CHAIN_ID", TORONTOCOIN_RUNTIME.chainId);
  const runtime =
    getTorontoCoinRuntimeConfig({ citySlug: "tcoin", chainId: targetChainId }) ?? TORONTOCOIN_RUNTIME;

  return {
    provider: "transak",
    transakApiKey: parseString("ONRAMP_TRANSAK_API_KEY"),
    transakSecret: parseString("ONRAMP_TRANSAK_SECRET"),
    transakWebhookSecret: parseOptionalString("ONRAMP_TRANSAK_WEBHOOK_SECRET"),
    transakWidgetApiUrl: parseString("ONRAMP_TRANSAK_WIDGET_API_URL", "https://api-gateway-stg.transak.com/api/v2/auth/session"),
    transakAccessToken: parseString("ONRAMP_TRANSAK_ACCESS_TOKEN"),
    transakAuthorizationToken: parseOptionalString("ONRAMP_TRANSAK_USER_AUTH_TOKEN"),
    targetChainId: runtime.chainId,
    targetInputAsset: parseString("ONRAMP_TARGET_INPUT_ASSET", "USDC"),
    finalAsset: parseString("ONRAMP_FINAL_ASSET", runtime.cplTcoin.symbol),
    settlementTimeoutSeconds: Math.max(60, parseInteger("ONRAMP_SETTLEMENT_TIMEOUT_SECONDS", 600)),
    maxAutoAttempts: Math.max(1, parseInteger("ONRAMP_MAX_AUTO_ATTEMPTS", 3)),
    maxManualAttempts: Math.max(1, parseInteger("ONRAMP_MAX_MANUAL_ATTEMPTS", 3)),
    slippageBps: Math.max(1, Math.min(5_000, parseInteger("ONRAMP_SLIPPAGE_BPS", 100))),
    deadlineSeconds: Math.max(60, parseInteger("ONRAMP_DEADLINE_SECONDS", 900)),
    hdMasterSeed: parseString("ONRAMP_HD_MASTER_SEED"),
    hdDerivationPathBase: parseString("ONRAMP_HD_DERIVATION_PATH_BASE", "m/44'/52752'/0'/0"),
    gasBankPrivateKey,
    gasTopupMinWei: parseBigint("ONRAMP_GAS_TOPUP_MIN_WEI", BigInt("1000000000000000")),
    gasTopupTargetWei: parseBigint("ONRAMP_GAS_TOPUP_TARGET_WEI", BigInt("5000000000000000")),
    inputTokenAddress: runtime.scenarioInputToken,
    routerAddress: runtime.liquidityRouter,
    poolRegistryAddress: runtime.poolRegistry,
    bootstrapPoolId: runtime.bootstrapPoolId,
    cplTcoinAddress: runtime.cplTcoin.address,
    cplTcoinDecimals: runtime.cplTcoin.decimals,
    reserveAssetId: runtime.reserveAssetId,
    appBaseUrl: parseString("ONRAMP_APP_BASE_URL", "http://localhost:3000"),
    rpcUrl: parseString("INDEXER_CHAIN_RPC_URL", runtime.rpcUrl),
    buyCheckoutFlag:
      (parseOptionalString("NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT", "false") ?? "false").toLowerCase() === "true",
  };
}
