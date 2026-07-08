import { createPublicClient, http, type PublicClient } from "viem";

export type RegistryBootstrapConfig = {
  chainId: number;
  rpcUrl: string;
  address: `0x${string}`;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// NOTE: replace with the actual deployed registry address after first deployment.
export const CITY_REGISTRY_BOOTSTRAP: RegistryBootstrapConfig = {
  chainId: 545,
  rpcUrl: "https://testnet.evm.nodes.onflow.org",
  address: ZERO_ADDRESS,
};

let registryPublicClient: PublicClient | null = null;

export function getCityRegistryBootstrapConfig(): RegistryBootstrapConfig {
  return CITY_REGISTRY_BOOTSTRAP;
}

export function assertCityRegistryConfigured(): void {
  if (CITY_REGISTRY_BOOTSTRAP.address === ZERO_ADDRESS) {
    throw new Error(
      "City registry bootstrap address is not configured. Deploy the registry and update CITY_REGISTRY_BOOTSTRAP.address."
    );
  }
}

export function getCityRegistryPublicClient(): PublicClient {
  assertCityRegistryConfigured();

  if (!registryPublicClient) {
    registryPublicClient = createPublicClient({
      transport: http(CITY_REGISTRY_BOOTSTRAP.rpcUrl),
    });
  }

  return registryPublicClient;
}

export function __resetRegistryPublicClientForTests() {
  registryPublicClient = null;
}

