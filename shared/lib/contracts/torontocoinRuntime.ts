import { getAddress, keccak256, type Address, type Hex } from "viem";

export type TorontoCoinTokenMetadata = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  explorerPath: string;
};

export type TrackedTorontoCoinPool = {
  poolId: Hex;
  poolAddress: Address;
  name: string;
  tokens: Address[];
  expectedIndexerVisibility: boolean;
  previewEnabled: boolean;
  acceptanceEnabled: boolean;
};

export type TorontoCoinRuntimeConfig = {
  target: "celo-mainnet" | "celo-sepolia-pay-link";
  citySlug: "tcoin";
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  governance: Address;
  treasuryController: Address;
  liquidityRouter: Address;
  poolRegistry: Address;
  reserveRegistry: Address;
  reserveInputRouter: Address;
  sarafuSwapPoolAdapter: Address;
  mentoBrokerSwapAdapter: Address;
  mrTcoin: TorontoCoinTokenMetadata;
  cplTcoin: TorontoCoinTokenMetadata;
  bootstrapPoolId: Hex;
  bootstrapSwapPool: Address;
  trackedPools: readonly TrackedTorontoCoinPool[];
  scenarioInputToken: Address;
  scenarioInputAmount: bigint;
  reserveAssetId: Hex;
  reserveAssetToken: Address;
  validatedAt: number;
  deployedAt: number;
};

export type TorontoCoinWalletRuntimeConfig = Pick<
  TorontoCoinRuntimeConfig,
  | "target"
  | "citySlug"
  | "chainId"
  | "rpcUrl"
  | "explorerBaseUrl"
  | "poolRegistry"
  | "sarafuSwapPoolAdapter"
  | "bootstrapSwapPool"
> & {
  purpose: "production" | "pay-link-only";
  cplTcoin: TorontoCoinTokenMetadata;
  mrTcoin: TorontoCoinTokenMetadata;
  transferGasLimit: bigint;
  maxFeePerGasWei: bigint;
  cplTcoinRuntimeCodeHash: Hex | null;
};

export type TorontoCoinWalletRuntimeSelection =
  | { configured: true; runtime: TorontoCoinWalletRuntimeConfig }
  | { configured: false; reason: string };

export class TorontoCoinWalletRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TorontoCoinWalletRuntimeUnavailableError";
  }
}

const CELO_MAINNET_RPC_URL = "https://forno.celo.org";
const CELOSCAN_BASE_URL = "https://celoscan.io";

// Derived from the live generated deployment artefacts in contracts/foundry/deployments/torontocoin/celo-mainnet/.
export const TORONTOCOIN_RUNTIME: TorontoCoinRuntimeConfig = {
  target: "celo-mainnet",
  citySlug: "tcoin",
  chainId: 42220,
  rpcUrl: CELO_MAINNET_RPC_URL,
  explorerBaseUrl: CELOSCAN_BASE_URL,
  governance: getAddress("0x0Ae274e0898499C48832149266A6625a4D20c581"),
  treasuryController: getAddress("0x5A860da554bf1301708db7c41C4e540135e3FCE4"),
  liquidityRouter: getAddress("0x6BBa692FC6b2F7F19a925a11EEbfc4Dd67C424a7"),
  poolRegistry: getAddress("0x3e9926Ff48b84f6E625E833219353b9cfb473A74"),
  reserveRegistry: getAddress("0x2b79c161b679e9821a92a86f4f7C818BfaCb638a"),
  reserveInputRouter: getAddress("0xdCD1419C195e95dBe6BD5494597d5aF0568Ba1a3"),
  sarafuSwapPoolAdapter: getAddress("0x9EBEedA7c8a98fc58775f088A3210fAC781A1e47"),
  mentoBrokerSwapAdapter: getAddress("0x954103b12cC80599Be910f10e8A69f2909Ba013B"),
  mrTcoin: {
    address: getAddress("0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3"),
    symbol: "mrTCOIN",
    name: "Market Reserve Toronto Coin",
    decimals: 6,
    explorerPath: "/token/0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3",
  },
  cplTcoin: {
    address: getAddress("0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19"),
    symbol: "cplTCOIN",
    name: "Community Pool Liquidity Toronto Coin",
    decimals: 6,
    explorerPath: "/token/0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
  },
  bootstrapPoolId:
    "0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000",
  bootstrapSwapPool: getAddress("0xDe2a979EC49811aD27730e451651e52b4540c594"),
  trackedPools: [
    {
      poolId:
        "0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000",
      poolAddress: getAddress("0xDe2a979EC49811aD27730e451651e52b4540c594"),
      name: "Toronto Genesis Pool",
      tokens: [
        getAddress("0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3"),
        getAddress("0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19"),
      ],
      expectedIndexerVisibility: true,
      previewEnabled: true,
      acceptanceEnabled: true,
    },
  ],
  scenarioInputToken: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
  scenarioInputAmount: BigInt(1_000_000),
  reserveAssetId:
    "0x5553444d00000000000000000000000000000000000000000000000000000000",
  reserveAssetToken: getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a"),
  deployedAt: 1774220858,
  validatedAt: 1774220945,
};

const MAINNET_WALLET_RUNTIME: TorontoCoinWalletRuntimeConfig = {
  target: TORONTOCOIN_RUNTIME.target,
  purpose: "production",
  citySlug: TORONTOCOIN_RUNTIME.citySlug,
  chainId: TORONTOCOIN_RUNTIME.chainId,
  rpcUrl: TORONTOCOIN_RUNTIME.rpcUrl,
  explorerBaseUrl: TORONTOCOIN_RUNTIME.explorerBaseUrl,
  poolRegistry: TORONTOCOIN_RUNTIME.poolRegistry,
  sarafuSwapPoolAdapter: TORONTOCOIN_RUNTIME.sarafuSwapPoolAdapter,
  bootstrapSwapPool: TORONTOCOIN_RUNTIME.bootstrapSwapPool,
  mrTcoin: TORONTOCOIN_RUNTIME.mrTcoin,
  cplTcoin: TORONTOCOIN_RUNTIME.cplTcoin,
  transferGasLimit: BigInt(250_000),
  maxFeePerGasWei: BigInt(100_000_000_000),
  cplTcoinRuntimeCodeHash: null,
};

const ADDRESS_KEYS = [
  "poolRegistry",
  "sarafuSwapPoolAdapter",
  "bootstrapSwapPool",
] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseHttpsUrl(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new Error(`${key} must be an HTTPS URL.`);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) {
      throw new Error("invalid protocol");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${key} must be an HTTPS URL.`);
  }
}

function parseNonZeroAddress(value: unknown, key: string): Address {
  const address = getAddress(String(value));
  if (address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${key} must be a non-zero address.`);
  }
  return address;
}

function parsePositiveBigInt(value: unknown, key: string): bigint {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${key} must be a positive base-10 integer string.`);
  }
  return BigInt(value);
}

function parseCodeHash(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/i.test(value)) {
    throw new Error("cplTcoinRuntimeCodeHash must be a non-zero 32-byte hash.");
  }
  return value.toLowerCase() as Hex;
}

function parsePreviewToken(value: unknown, key: string): TorontoCoinTokenMetadata {
  if (!value || typeof value !== "object") {
    throw new Error(`${key} is required.`);
  }
  const token = value as Record<string, unknown>;
  if (token.decimals !== 6) {
    throw new Error(`${key}.decimals must be 6.`);
  }
  if (typeof token.symbol !== "string" || typeof token.name !== "string") {
    throw new Error(`${key} identity is incomplete.`);
  }
  const address = parseNonZeroAddress(token.address, `${key}.address`);
  return {
    address,
    symbol: token.symbol,
    name: token.name,
    decimals: 6,
    explorerPath: `/token/${address}`,
  };
}

export function parseTorontoCoinPreviewRuntimeManifest(
  rawManifest: string
): TorontoCoinWalletRuntimeConfig {
  const parsed = JSON.parse(rawManifest) as Record<string, unknown>;
  if (parsed.target !== "celo-sepolia-pay-link" || parsed.purpose !== "pay-link-only") {
    throw new Error("Preview runtime must target the dedicated pay-link-only profile.");
  }
  if (parsed.chainId !== 11142220) {
    throw new Error("Preview runtime chainId must be Celo Sepolia (11142220).");
  }
  const rpcUrl = parseHttpsUrl(parsed.rpcUrl, "Preview runtime rpcUrl");
  const explorerBaseUrl = parseHttpsUrl(
    parsed.explorerBaseUrl,
    "Preview runtime explorerBaseUrl"
  );

  const addresses = Object.fromEntries(
    ADDRESS_KEYS.map((key) => [key, parseNonZeroAddress(parsed[key], key)])
  ) as Record<(typeof ADDRESS_KEYS)[number], Address>;
  const cplTcoin = parsePreviewToken(parsed.cplTcoin, "cplTcoin");
  const mrTcoin = parsePreviewToken(parsed.mrTcoin, "mrTcoin");
  if (cplTcoin.symbol !== "cplTCOIN-cs") {
    throw new Error("Preview wallet token must be the intended cplTCOIN-cs deployment.");
  }
  if (mrTcoin.symbol !== "mrTCOIN-cs") {
    throw new Error("Preview internal token must be the intended mrTCOIN-cs deployment.");
  }
  if (cplTcoin.address === mrTcoin.address) {
    throw new Error("Preview cplTCOIN and mrTCOIN addresses must be distinct.");
  }

  return {
    target: "celo-sepolia-pay-link",
    purpose: "pay-link-only",
    citySlug: "tcoin",
    chainId: 11142220,
    rpcUrl,
    explorerBaseUrl,
    ...addresses,
    cplTcoin,
    mrTcoin,
    transferGasLimit: parsePositiveBigInt(parsed.transferGasLimit, "transferGasLimit"),
    maxFeePerGasWei: parsePositiveBigInt(parsed.maxFeePerGasWei, "maxFeePerGasWei"),
    cplTcoinRuntimeCodeHash: parseCodeHash(parsed.cplTcoinRuntimeCodeHash),
  };
}

export function assertTorontoCoinWalletTokenIdentity(options: {
  runtime: Pick<
    TorontoCoinWalletRuntimeConfig,
    "chainId" | "cplTcoin" | "cplTcoinRuntimeCodeHash"
  >;
  actualChainId: number;
  bytecode: Hex | undefined;
  name: string;
  symbol: string;
  decimals: number;
}): void {
  const { runtime } = options;
  if (options.actualChainId !== runtime.chainId) {
    throw new Error(
      `Wallet RPC chain mismatch: expected ${runtime.chainId}, received ${options.actualChainId}.`
    );
  }
  if (!options.bytecode || options.bytecode === "0x") {
    throw new Error("Configured cplTCOIN address has no deployed bytecode.");
  }
  if (
    runtime.cplTcoinRuntimeCodeHash &&
    keccak256(options.bytecode).toLowerCase() !== runtime.cplTcoinRuntimeCodeHash.toLowerCase()
  ) {
    throw new Error("Configured cplTCOIN runtime bytecode does not match the reviewed deployment.");
  }
  if (
    options.name !== runtime.cplTcoin.name ||
    options.symbol !== runtime.cplTcoin.symbol ||
    options.decimals !== runtime.cplTcoin.decimals ||
    options.decimals !== 6
  ) {
    throw new Error("Configured cplTCOIN live metadata does not match the reviewed six-decimal token.");
  }
}

export function getTorontoCoinWalletRuntimeSelection(input: {
  target?: string | null;
  manifest?: string | null;
  appEnvironment?: string | null;
  citySlug?: string | null;
} = {}): TorontoCoinWalletRuntimeSelection {
  const citySlug = (input.citySlug ?? process.env.NEXT_PUBLIC_CITYCOIN ?? "").trim().toLowerCase();
  if (citySlug !== "tcoin") {
    return {
      configured: false,
      reason: `TorontoCoin wallet runtime does not support city scope "${citySlug || "unset"}".`,
    };
  }
  const appEnvironment = (
    input.appEnvironment ?? process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? ""
  ).trim();
  const target = (input.target ?? process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET ?? "").trim();
  if (!target) {
    return {
      configured: false,
      reason: "TorontoCoin wallet target is not configured for this environment.",
    };
  }
  if (target === "celo-mainnet") {
    if (appEnvironment !== "production") {
      return {
        configured: false,
        reason: "Celo mainnet requires the explicit Production app environment.",
      };
    }
    return { configured: true, runtime: MAINNET_WALLET_RUNTIME };
  }
  if (target !== "celo-sepolia-pay-link") {
    return { configured: false, reason: `Unsupported TorontoCoin wallet target: ${target}.` };
  }

  if (appEnvironment === "production") {
    return {
      configured: false,
      reason: "The Celo Sepolia pay-link profile is disabled in Production.",
    };
  }

  const manifest = input.manifest ?? process.env.NEXT_PUBLIC_TCOIN_RUNTIME_MANIFEST;
  if (!manifest?.trim()) {
    return {
      configured: false,
      reason: "Preview wallet runtime is not configured. Add the reviewed Celo Sepolia manifest.",
    };
  }
  try {
    return { configured: true, runtime: parseTorontoCoinPreviewRuntimeManifest(manifest) };
  } catch (error) {
    return {
      configured: false,
      reason: `Preview wallet runtime is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export function getTorontoCoinWalletRuntimeOrThrow(): TorontoCoinWalletRuntimeConfig {
  const selection = getTorontoCoinWalletRuntimeSelection();
  if (!selection.configured) {
    throw new TorontoCoinWalletRuntimeUnavailableError(selection.reason);
  }
  return selection.runtime;
}

export function isTorontoCoinPayLinkPreviewTarget(): boolean {
  return process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET?.trim() === "celo-sepolia-pay-link";
}

export function isTorontoCoinMainnetRuntimeAdmitted(input: {
  appEnvironment?: string | null;
  target?: string | null;
  citySlug?: string | null;
} = {}): boolean {
  const appEnvironment = (input.appEnvironment ?? process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim();
  const target = (input.target ?? process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET ?? "").trim();
  const citySlug = (input.citySlug ?? process.env.NEXT_PUBLIC_CITYCOIN ?? "").trim().toLowerCase();
  return appEnvironment === "production" && target === "celo-mainnet" && citySlug === "tcoin";
}

export function assertTorontoCoinMainnetRuntimeAdmitted(): void {
  if (!isTorontoCoinMainnetRuntimeAdmitted()) {
    throw new TorontoCoinWalletRuntimeUnavailableError(
      "TorontoCoin mainnet operations require the explicit Production celo-mainnet profile."
    );
  }
}

export function isTorontoCoinRuntimeScope(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}): boolean {
  const citySlug = (input?.citySlug ?? "tcoin").trim().toLowerCase();
  const chainId = input?.chainId ?? 42220;
  return citySlug === TORONTOCOIN_RUNTIME.citySlug && chainId === TORONTOCOIN_RUNTIME.chainId;
}

export function getTorontoCoinRuntimeConfig(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}): TorontoCoinRuntimeConfig | null {
  return isTorontoCoinMainnetRuntimeAdmitted() && isTorontoCoinRuntimeScope(input)
    ? TORONTOCOIN_RUNTIME
    : null;
}

export function getTorontoCoinRpcUrl(): string {
  assertTorontoCoinMainnetRuntimeAdmitted();
  return process.env.INDEXER_CHAIN_RPC_URL?.trim() || TORONTOCOIN_RUNTIME.rpcUrl;
}

export function getTorontoCoinExplorerTxUrl(txHash: string): string {
  return `${getTorontoCoinWalletRuntimeOrThrow().explorerBaseUrl}/tx/${txHash}`;
}

export function getTorontoCoinExplorerAddressUrl(address: Address): string {
  return `${getTorontoCoinWalletRuntimeOrThrow().explorerBaseUrl}/address/${address}`;
}

export function getTorontoCoinWalletToken(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}): TorontoCoinTokenMetadata | null {
  return isTorontoCoinMainnetRuntimeAdmitted() && isTorontoCoinRuntimeScope(input)
    ? TORONTOCOIN_RUNTIME.cplTcoin
    : null;
}

export function getConfiguredTorontoCoinTrackedPools(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}): readonly TrackedTorontoCoinPool[] {
  return isTorontoCoinMainnetRuntimeAdmitted() && isTorontoCoinRuntimeScope(input)
    ? TORONTOCOIN_RUNTIME.trackedPools
    : [];
}
