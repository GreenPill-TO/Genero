import { getAddress, type Address, type Hex } from "viem";

export type TorontoCoinTokenMetadata = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  explorerPath: string;
};

export type TorontoCoinRuntimeConfig = {
  target: "celo-mainnet";
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
  scenarioInputToken: Address;
  scenarioInputAmount: bigint;
  reserveAssetId: Hex;
  reserveAssetToken: Address;
  validatedAt: number;
  deployedAt: number;
};

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
  scenarioInputToken: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
  scenarioInputAmount: BigInt(1_000_000),
  reserveAssetId:
    "0x5553444d00000000000000000000000000000000000000000000000000000000",
  reserveAssetToken: getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a"),
  deployedAt: 1774220858,
  validatedAt: 1774220945,
};

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
  return isTorontoCoinRuntimeScope(input) ? TORONTOCOIN_RUNTIME : null;
}

export function getTorontoCoinRpcUrl(): string {
  return process.env.INDEXER_CHAIN_RPC_URL?.trim() || TORONTOCOIN_RUNTIME.rpcUrl;
}

export function getTorontoCoinExplorerTxUrl(txHash: string): string {
  return `${TORONTOCOIN_RUNTIME.explorerBaseUrl}/tx/${txHash}`;
}

export function getTorontoCoinExplorerAddressUrl(address: Address): string {
  return `${TORONTOCOIN_RUNTIME.explorerBaseUrl}/address/${address}`;
}

export function getTorontoCoinWalletToken(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}): TorontoCoinTokenMetadata | null {
  return isTorontoCoinRuntimeScope(input) ? TORONTOCOIN_RUNTIME.cplTcoin : null;
}
