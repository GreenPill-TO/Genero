import { getAddress, type Address } from "npm:viem@2.23.3";

export const TORONTOCOIN_RUNTIME = {
  citySlug: "tcoin",
  chainId: 42220,
  rpcUrl: "https://forno.celo.org",
  liquidityRouter: getAddress("0x6BBa692FC6b2F7F19a925a11EEbfc4Dd67C424a7"),
  poolRegistry: getAddress("0x3e9926Ff48b84f6E625E833219353b9cfb473A74"),
  reserveRegistry: getAddress("0x2b79c161b679e9821a92a86f4f7C818BfaCb638a"),
  reserveInputRouter: getAddress("0xdCD1419C195e95dBe6BD5494597d5aF0568Ba1a3"),
  mentoBrokerSwapAdapter: getAddress("0x954103b12cC80599Be910f10e8A69f2909Ba013B"),
  mrTcoin: {
    address: getAddress("0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3"),
    symbol: "mrTCOIN",
    decimals: 6,
  },
  cplTcoin: {
    address: getAddress("0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19"),
    symbol: "cplTCOIN",
    decimals: 6,
  },
  bootstrapPoolId:
    "0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000" as const,
  bootstrapSwapPool: getAddress("0xDe2a979EC49811aD27730e451651e52b4540c594"),
  scenarioInputToken: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
  reserveAssetId:
    "0x5553444d00000000000000000000000000000000000000000000000000000000" as const,
};

export function getTorontoCoinRuntimeConfig(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}) {
  const citySlug = (input?.citySlug ?? "tcoin").trim().toLowerCase();
  const chainId = input?.chainId ?? 42220;
  if (citySlug === TORONTOCOIN_RUNTIME.citySlug && chainId === TORONTOCOIN_RUNTIME.chainId) {
    return TORONTOCOIN_RUNTIME;
  }
  return null;
}

export function isTorontoCoinRuntimeScope(input?: {
  citySlug?: string | null;
  chainId?: number | null;
}) {
  return Boolean(getTorontoCoinRuntimeConfig(input));
}

export type TorontoCoinRuntimeToken = {
  address: Address;
  symbol: string;
  decimals: number;
};
