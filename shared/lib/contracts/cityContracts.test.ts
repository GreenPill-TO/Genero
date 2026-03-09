import { beforeEach, describe, expect, it, vi } from "vitest";

const { readContractMock, getClientMock } = vi.hoisted(() => {
  const readContract = vi.fn();
  const getClient = vi.fn(() => ({ readContract }));
  return { readContractMock: readContract, getClientMock: getClient };
});

vi.mock("@shared/lib/contracts/cityRegistryClient", () => ({
  CITY_REGISTRY_BOOTSTRAP: {
    chainId: 545,
    rpcUrl: "https://testnet.evm.nodes.onflow.org",
    address: "0x1111111111111111111111111111111111111111",
  },
  getCityRegistryPublicClient: getClientMock,
}));

import {
  clearActiveCityContractsCache,
  citySlugToCityId,
  getActiveCityContracts,
  getRpcUrlForChainId,
} from "./cityContracts";

describe("cityContracts", () => {
  beforeEach(() => {
    clearActiveCityContractsCache();
    readContractMock.mockReset();
    getClientMock.mockClear();
  });

  it("derives a deterministic cityId from a city slug", () => {
    const idA = citySlugToCityId("tcoin");
    const idB = citySlugToCityId("TCOIN");
    expect(idA).toBe(idB);
    expect(idA).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("fetches active city contracts and caches results", async () => {
    readContractMock.mockResolvedValue({
      version: 2n,
      createdAt: 1700000000n,
      promotedAt: 1700000100n,
      chainId: 545n,
      contracts: {
        tcoin: "0x0000000000000000000000000000000000000001",
        ttc: "0x0000000000000000000000000000000000000002",
        cad: "0x0000000000000000000000000000000000000003",
        orchestrator: "0x0000000000000000000000000000000000000004",
        voting: "0x0000000000000000000000000000000000000005",
      },
      metadataURI: "ipfs://bundle-v2",
      exists: true,
    });

    const first = await getActiveCityContracts({ citySlug: "tcoin" });
    const second = await getActiveCityContracts({ citySlug: "tcoin" });

    expect(first.version).toBe(2);
    expect(first.chainId).toBe(545);
    expect(first.contracts.TCOIN).toBe("0x0000000000000000000000000000000000000001");
    expect(second.version).toBe(2);

    expect(getClientMock).toHaveBeenCalledTimes(1);
    expect(readContractMock).toHaveBeenCalledTimes(1);
  });

  it("throws for unsupported chain IDs", () => {
    expect(() => getRpcUrlForChainId(99999)).toThrow(
      "No configured RPC URL for chainId 99999. Add it to CHAIN_RPC_URLS."
    );
  });
});
