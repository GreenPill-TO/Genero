/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => {
  const tcoinPool = {
    poolId:
      "0x746f726f6e746f2d67656e657369732d706f6f6c000000000000000000000000",
    poolAddress: "0xDe2a979EC49811aD27730e451651e52b4540c594",
    expectedIndexerVisibility: true,
  };

  return {
    TORONTOCOIN_RUNTIME: {
      citySlug: "tcoin",
      chainId: 42220,
    },
    getTorontoCoinWalletToken: vi.fn((input?: { citySlug?: string | null; chainId?: number | null }) =>
      input?.citySlug === "tcoin" && input?.chainId === 42220
        ? { address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19" }
        : null
    ),
    getConfiguredTorontoCoinTrackedPools: vi.fn((input?: { citySlug?: string | null; chainId?: number | null }) =>
      input?.citySlug === "tcoin" && input?.chainId === 42220 ? [tcoinPool] : []
    ),
  };
});

import { getIndexerScopeStatusReadModel } from "./statusReadModel";

describe("getIndexerScopeStatusReadModel", () => {
  const originalCityCoin = process.env.NEXT_PUBLIC_CITYCOIN;
  const originalIndexerChainId = process.env.INDEXER_CHAIN_ID;

  beforeEach(() => {
    if (originalCityCoin === undefined) {
      delete process.env.NEXT_PUBLIC_CITYCOIN;
    } else {
      process.env.NEXT_PUBLIC_CITYCOIN = originalCityCoin;
    }

    if (originalIndexerChainId === undefined) {
      delete process.env.INDEXER_CHAIN_ID;
    } else {
      process.env.INDEXER_CHAIN_ID = originalIndexerChainId;
    }
  });

  afterEach(() => {
    if (originalCityCoin === undefined) {
      delete process.env.NEXT_PUBLIC_CITYCOIN;
    } else {
      process.env.NEXT_PUBLIC_CITYCOIN = originalCityCoin;
    }

    if (originalIndexerChainId === undefined) {
      delete process.env.INDEXER_CHAIN_ID;
    } else {
      process.env.INDEXER_CHAIN_ID = originalIndexerChainId;
    }
  });

  it("loads aggregate indexer status through the RPC and enriches configured pool tracking", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        scopeKey: "tcoin:42220",
        citySlug: "tcoin",
        chainId: 42220,
        runControl: null,
        checkpoints: [],
        activePoolCount: 1,
        activeTokenCount: 2,
        biaSummary: {
          activeBias: 0,
          mappedPools: 0,
          unmappedPools: 0,
          staleMappings: 0,
          componentMismatches: 0,
          lastActivityByBia: [],
        },
        voucherSummary: {
          trackedVoucherTokens: 0,
          walletsWithVoucherBalances: 0,
          merchantCreditRows: 0,
          lastVoucherBlock: null,
        },
        torontoCoinTracking: {
          requiredTokenAddress: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
          cplTcoinTracked: true,
          trackedPools: [],
        },
        activePoolDetails: [
          {
            poolAddress: "0xde2a979ec49811ad27730e451651e52b4540c594",
            tokenAddresses: [
              "0x63ed4cfad21e9f4a30ad93a199f382f98caf59c3",
              "0xaec330e9d808e4e938bf830016c6b2eb350e1a19",
            ],
          },
        ],
      },
      error: null,
    });

    const status = await getIndexerScopeStatusReadModel({
      supabase: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith("indexer_scope_status_v1", {
      p_city_slug: "tcoin",
      p_chain_id: 42220,
      p_required_token_address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
    });
    expect(status.torontoCoinTracking?.cplTcoinTracked).toBe(true);
    expect(status.torontoCoinTracking?.trackedPools).toEqual([
      expect.objectContaining({
        poolAddress: "0xDe2a979EC49811aD27730e451651e52b4540c594",
        tracked: true,
        healthy: true,
      }),
    ]);
    expect("activePoolDetails" in status).toBe(false);
  });

  it("defaults omitted scope parameters from the configured runtime environment", async () => {
    process.env.NEXT_PUBLIC_CITYCOIN = "othercoin";
    process.env.INDEXER_CHAIN_ID = "12345";

    const rpc = vi.fn().mockResolvedValue({
      data: {
        scopeKey: "othercoin:12345",
        citySlug: "othercoin",
        chainId: 12345,
        runControl: null,
        checkpoints: [],
        activePoolCount: 0,
        activeTokenCount: 0,
        biaSummary: {
          activeBias: 0,
          mappedPools: 0,
          unmappedPools: 0,
          staleMappings: 0,
          componentMismatches: 0,
          lastActivityByBia: [],
        },
        voucherSummary: {
          trackedVoucherTokens: 0,
          walletsWithVoucherBalances: 0,
          merchantCreditRows: 0,
          lastVoucherBlock: null,
        },
        torontoCoinTracking: {
          requiredTokenAddress: "",
          cplTcoinTracked: false,
          trackedPools: [],
        },
        activePoolDetails: [],
      },
      error: null,
    });

    await getIndexerScopeStatusReadModel({
      supabase: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith("indexer_scope_status_v1", {
      p_city_slug: "othercoin",
      p_chain_id: 12345,
      p_required_token_address: null,
    });
  });

  it("raises a scoped error when the RPC is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Could not find the function public.indexer_scope_status_v1 in the schema cache" },
    });

    await expect(
      getIndexerScopeStatusReadModel({
        supabase: { rpc } as never,
      })
    ).rejects.toThrow("Failed to load indexer scope status");
  });
});
