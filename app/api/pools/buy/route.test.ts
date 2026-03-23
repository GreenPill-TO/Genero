/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    userBiaId: "bia-1" as string | null,
    mapping: {
      poolAddress: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      mappingStatus: "active",
      effectiveTo: undefined,
    } as any,
    biaRow: {
      id: "bia-1",
      city_slug: "tcoin",
      status: "active",
    } as any,
    appInstanceId: 77,
    insertedPurchases: [] as Array<Record<string, unknown>>,
    governanceActions: [] as Array<Record<string, unknown>>,
  };

  const resolveApiAuthContextMock = vi.fn(async () => ({
    serviceRole: {
      from: (table: string) => {
        if (table === "bia_registry") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: state.biaRow, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "pool_purchase_requests") {
          return {
            insert: (payload: Record<string, unknown>) => {
              state.insertedPurchases.push(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "purchase-1", ...payload },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        if (table === "governance_actions_log") {
          return {
            insert: (payload: Record<string, unknown>) => {
              state.governanceActions.push(payload);
              return Promise.resolve({ error: null });
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
    userRow: { id: 15 },
  }));

  return {
    state,
    resolveApiAuthContextMock,
    resolveActiveUserBiaMock: vi.fn(async () => state.userBiaId),
    resolveActiveBiaPoolMappingMock: vi.fn(async () => state.mapping),
    getActiveCityContractsMock: vi.fn(async () => ({
      chainId: 42220,
      contracts: {
        TCOIN: "0x298A698031e2fD7D8F0c830F3FD887601b40058C",
      },
    })),
    getTorontoCoinRuntimeConfigMock: vi.fn(() => ({
      cplTcoin: { address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19" },
    })),
    assertActiveMappingMock: vi.fn(),
    assertBiaPoolNotFrozenMock: vi.fn(async () => undefined),
    assertPoolTokenSupportMock: vi.fn(async () => undefined),
  };
});

vi.mock("@shared/lib/bia/apiAuth", () => ({
  resolveApiAuthContext: h.resolveApiAuthContextMock,
}));

vi.mock("@shared/lib/bia/server", () => ({
  resolveCitySlug: (value?: string) => value?.trim().toLowerCase() || "tcoin",
  resolveActiveAppInstanceId: vi.fn(async () => h.state.appInstanceId),
  toNumber: (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  },
}));

vi.mock("@shared/lib/sarafu/routing", () => ({
  resolveActiveUserBia: h.resolveActiveUserBiaMock,
  resolveActiveBiaPoolMapping: h.resolveActiveBiaPoolMappingMock,
}));

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: h.getActiveCityContractsMock,
}));

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  getTorontoCoinRuntimeConfig: h.getTorontoCoinRuntimeConfigMock,
}));

vi.mock("@shared/lib/sarafu/guards", () => ({
  assertActiveMapping: h.assertActiveMappingMock,
  assertBiaPoolNotFrozen: h.assertBiaPoolNotFrozenMock,
  assertPoolTokenSupport: h.assertPoolTokenSupportMock,
}));

import { POST } from "./route";

describe("POST /api/pools/buy", () => {
  beforeEach(() => {
    h.state.userBiaId = "bia-1";
    h.state.mapping = {
      poolAddress: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      mappingStatus: "active",
      effectiveTo: undefined,
    };
    h.state.biaRow = {
      id: "bia-1",
      city_slug: "tcoin",
      status: "active",
    };
    h.state.insertedPurchases = [];
    h.state.governanceActions = [];

    h.resolveApiAuthContextMock.mockClear();
    h.resolveActiveUserBiaMock.mockClear();
    h.resolveActiveBiaPoolMappingMock.mockClear();
    h.getActiveCityContractsMock.mockClear();
    h.getTorontoCoinRuntimeConfigMock.mockClear();
    h.assertActiveMappingMock.mockClear();
    h.assertBiaPoolNotFrozenMock.mockClear();
    h.assertPoolTokenSupportMock.mockClear();
  });

  it("creates a pool-aware purchase request", async () => {
    const req = new Request("http://localhost/api/pools/buy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        citySlug: "tcoin",
        chainId: 42220,
        fiatAmount: 30,
        tokenAmount: 10,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.routing.poolAddress).toBe(h.state.mapping.poolAddress);
    expect(body.routing.biaId).toBe("bia-1");

    expect(h.state.insertedPurchases).toHaveLength(1);
    expect(h.state.insertedPurchases[0]).toMatchObject({
      bia_id: "bia-1",
      pool_address: h.state.mapping.poolAddress,
      token_address: "0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19",
      fiat_amount: 30,
      token_amount: 10,
      app_instance_id: h.state.appInstanceId,
      status: "processing",
    });

    expect(h.assertActiveMappingMock).toHaveBeenCalledTimes(1);
    expect(h.assertBiaPoolNotFrozenMock).toHaveBeenCalledTimes(1);
    expect(h.assertPoolTokenSupportMock).toHaveBeenCalledTimes(1);
    expect(h.state.governanceActions).toHaveLength(1);
  });

  it("returns 400 when no active user BIA exists", async () => {
    h.state.userBiaId = null;

    const req = new Request("http://localhost/api/pools/buy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fiatAmount: 15,
        tokenAmount: 5,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(String(body.error)).toContain("No active BIA affiliation");
    expect(h.state.insertedPurchases).toHaveLength(0);
  });
});
