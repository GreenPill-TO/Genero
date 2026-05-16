import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestCityExchangeRate } from "./rates";

describe("ingestCityExchangeRate", () => {
  const readContractMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const orderByIndexedMock = vi.fn(() => ({ limit: limitMock }));
  const orderByObservedMock = vi.fn(() => ({ order: orderByIndexedMock }));
  const eqMock = vi.fn(() => ({ order: orderByObservedMock, limit: limitMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const insertMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table === "citycoin_exchange_rates") {
      return {
        select: selectMock,
        insert: insertMock,
      };
    }

    return {
      select: selectMock,
    };
  });

  const supabase = {
    from: fromMock,
  } as any;

  const client = {
    readContract: readContractMock,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns setup_required when the oracle router is missing", async () => {
    const result = await ingestCityExchangeRate({
      supabase,
      client,
      citySlug: "tcoin",
      cityContracts: {
        citySlug: "tcoin",
        cityVersion: 1,
        chainId: 42220,
        contracts: {
          TCOIN: "0x0000000000000000000000000000000000000001",
          ORACLE_ROUTER: "0x0000000000000000000000000000000000000000",
        },
      },
    });

    expect(result.state).toBe("setup_required");
    expect(readContractMock).not.toHaveBeenCalled();
  });

  it("persists a city-scoped exchange-rate snapshot", async () => {
    readContractMock
      .mockResolvedValueOnce("0x00000000000000000000000000000000000000aa")
      .mockResolvedValueOnce(`0x${"1".repeat(64)}`)
      .mockResolvedValueOnce([3410000000000000000n, 1710417600n, false]);

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    insertMock.mockResolvedValue({ error: null });

    const result = await ingestCityExchangeRate({
      supabase,
      client,
      citySlug: "tcoin",
      cityContracts: {
        citySlug: "tcoin",
        cityVersion: 1,
        chainId: 42220,
        contracts: {
          TCOIN: "0x0000000000000000000000000000000000000001",
          ORACLE_ROUTER: "0x0000000000000000000000000000000000000002",
        },
      },
    });

    expect(result.state).toBe("ready");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        citycoin_id: 1,
        source: "oracle_router",
        rate: 3.41,
      })
    );
  });

  it("does not insert a duplicate snapshot when observed_at differs only by timestamp formatting", async () => {
    readContractMock
      .mockResolvedValueOnce("0x00000000000000000000000000000000000000aa")
      .mockResolvedValueOnce(`0x${"1".repeat(64)}`)
      .mockResolvedValueOnce([3410000000000000000n, 1710417600n, false]);

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          rate: "3.41",
          observed_at: "2024-03-14T12:00:00+00:00",
          asset_id: `0x${"1".repeat(64)}`,
          used_fallback: false,
        },
        error: null,
      });

    insertMock.mockResolvedValue({ error: null });

    const result = await ingestCityExchangeRate({
      supabase,
      client,
      citySlug: "tcoin",
      cityContracts: {
        citySlug: "tcoin",
        cityVersion: 1,
        chainId: 42220,
        contracts: {
          TCOIN: "0x0000000000000000000000000000000000000001",
          ORACLE_ROUTER: "0x0000000000000000000000000000000000000002",
        },
      },
    });

    expect(result.state).toBe("ready");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
