/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    appInstanceId: 42,
    storeRow: { id: 9 },
    storeBiaRow: { bia_id: "bia-1" },
    biaRow: { id: "bia-1", city_slug: "tcoin", status: "active" },
    mapping: {
      poolAddress: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      mappingStatus: "active",
      effectiveTo: undefined,
    } as any,
    currentRequest: {
      id: "req-1",
      status: "pending",
      bia_id: "bia-1",
      store_id: 9,
      chain_id: 42220,
      pool_address: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      settlement_amount: 100,
      settlement_asset: "CAD",
    } as Record<string, unknown>,
    insertedRedemptionRequests: [] as Array<Record<string, unknown>>,
    updatedRedemptionRequests: [] as Array<Record<string, unknown>>,
    insertedSettlements: [] as Array<Record<string, unknown>>,
    governanceActions: [] as Array<Record<string, unknown>>,
  };

  const resolveApiAuthContextMock = vi.fn(async () => ({
    serviceRole: {
      from: (table: string) => {
        if (table === "stores") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: state.storeRow, error: null }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "store_bia_affiliations") {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: state.storeBiaRow, error: null }),
                  }),
                }),
              }),
            }),
          };
        }

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

        if (table === "pool_redemption_requests") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: state.currentRequest, error: null }),
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => {
              state.insertedRedemptionRequests.push(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "req-created", ...payload },
                    error: null,
                  }),
                }),
              };
            },
            update: (payload: Record<string, unknown>) => {
              state.updatedRedemptionRequests.push(payload);
              state.currentRequest = {
                ...state.currentRequest,
                ...payload,
              };
              return {
                eq: () => ({
                  select: () => ({
                    single: async () => ({ data: state.currentRequest, error: null }),
                  }),
                }),
              };
            },
          };
        }

        if (table === "pool_redemption_settlements") {
          return {
            insert: (payload: Record<string, unknown>) => {
              state.insertedSettlements.push(payload);
              return {
                select: () => ({
                  single: async () => ({ data: { id: "settlement-1", ...payload }, error: null }),
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

        if (table === "store_employees") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: [{ store_id: 9 }], error: null }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table requested in test: ${table}`);
      },
    },
    userRow: { id: 21 },
  }));

  return {
    state,
    resolveApiAuthContextMock,
    resolveActiveBiaPoolMappingMock: vi.fn(async () => state.mapping),
    assertActiveMappingMock: vi.fn(),
    assertBiaPoolNotFrozenMock: vi.fn(async () => undefined),
    assertStoreNotSuspendedMock: vi.fn(async () => undefined),
    assertPoolRedemptionLimitsMock: vi.fn(async () => undefined),
    assertStoreAccessMock: vi.fn(async () => undefined),
    assertAdminOrOperatorMock: vi.fn(async () => undefined),
  };
});

vi.mock("@shared/lib/bia/apiAuth", () => ({
  resolveApiAuthContext: h.resolveApiAuthContextMock,
}));

vi.mock("@shared/lib/bia/server", () => ({
  assertStoreAccess: h.assertStoreAccessMock,
  assertAdminOrOperator: h.assertAdminOrOperatorMock,
  resolveActiveAppInstanceId: vi.fn(async () => h.state.appInstanceId),
  resolveCitySlug: (value?: string) => value?.trim().toLowerCase() || "tcoin",
  toNumber: (value: unknown, fallback = 0) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  },
  userHasAnyRole: vi.fn(async () => true),
}));

vi.mock("@shared/lib/sarafu/routing", () => ({
  resolveActiveBiaPoolMapping: h.resolveActiveBiaPoolMappingMock,
}));

vi.mock("@shared/lib/sarafu/guards", () => ({
  assertActiveMapping: h.assertActiveMappingMock,
  assertBiaPoolNotFrozen: h.assertBiaPoolNotFrozenMock,
  assertStoreNotSuspended: h.assertStoreNotSuspendedMock,
  assertPoolRedemptionLimits: h.assertPoolRedemptionLimitsMock,
}));

import { POST as requestPOST } from "./request/route";
import { GET as listGET } from "./list/route";
import { POST as approvePOST } from "./[id]/approve/route";
import { POST as settlePOST } from "./[id]/settle/route";

describe("/api/redemptions/* routes", () => {
  beforeEach(() => {
    h.state.storeRow = { id: 9 };
    h.state.storeBiaRow = { bia_id: "bia-1" };
    h.state.biaRow = { id: "bia-1", city_slug: "tcoin", status: "active" };
    h.state.mapping = {
      poolAddress: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      mappingStatus: "active",
      effectiveTo: undefined,
    };
    h.state.currentRequest = {
      id: "req-1",
      status: "pending",
      bia_id: "bia-1",
      store_id: 9,
      chain_id: 42220,
      pool_address: "0xA6f024Ad53766d332057d5e40215b695522ee3dE",
      settlement_amount: 100,
      settlement_asset: "CAD",
    };
    h.state.insertedRedemptionRequests = [];
    h.state.updatedRedemptionRequests = [];
    h.state.insertedSettlements = [];
    h.state.governanceActions = [];

    h.resolveApiAuthContextMock.mockClear();
    h.resolveActiveBiaPoolMappingMock.mockClear();
    h.assertActiveMappingMock.mockClear();
    h.assertBiaPoolNotFrozenMock.mockClear();
    h.assertStoreNotSuspendedMock.mockClear();
    h.assertPoolRedemptionLimitsMock.mockClear();
    h.assertStoreAccessMock.mockClear();
    h.assertAdminOrOperatorMock.mockClear();
  });

  it("creates a redemption request", async () => {
    const req = new Request("http://localhost/api/redemptions/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        citySlug: "tcoin",
        storeId: 9,
        chainId: 42220,
        tokenAmount: 25,
        settlementAmount: 80,
        settlementAsset: "CAD",
      }),
    });

    const res = await requestPOST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.routing.poolAddress).toBe(h.state.mapping.poolAddress);
    expect(h.state.insertedRedemptionRequests).toHaveLength(1);
    expect(h.state.insertedRedemptionRequests[0]).toMatchObject({
      store_id: 9,
      bia_id: "bia-1",
      chain_id: 42220,
      status: "pending",
      settlement_asset: "CAD",
      settlement_amount: 80,
      token_amount: 25,
    });
    expect(h.assertStoreAccessMock).toHaveBeenCalledTimes(1);
    expect(h.assertPoolRedemptionLimitsMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid list status filter", async () => {
    const req = new Request("http://localhost/api/redemptions/list?status=bad-status");
    const res = await listGET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toContain("Invalid status filter");
  });

  it("approves a pending redemption request", async () => {
    h.state.currentRequest = {
      ...h.state.currentRequest,
      status: "pending",
    };

    const req = new Request("http://localhost/api/redemptions/req-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ citySlug: "tcoin", approve: true }),
    });

    const res = await approvePOST(req, { params: { id: "req-1" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.request.status).toBe("approved");
    expect(h.state.updatedRedemptionRequests).toHaveLength(1);
    expect(h.state.updatedRedemptionRequests[0]).toMatchObject({
      status: "approved",
    });
    expect(h.assertAdminOrOperatorMock).toHaveBeenCalledTimes(1);
  });

  it("settles an approved redemption request", async () => {
    h.state.currentRequest = {
      ...h.state.currentRequest,
      status: "approved",
      settlement_amount: 95,
      settlement_asset: "CAD",
    };

    const req = new Request("http://localhost/api/redemptions/req-1/settle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        citySlug: "tcoin",
        settlementAmount: 95,
        settlementAsset: "CAD",
        txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
      }),
    });

    const res = await settlePOST(req, { params: { id: "req-1" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.request.status).toBe("settled");
    expect(h.state.insertedSettlements).toHaveLength(1);
    expect(h.state.insertedSettlements[0]).toMatchObject({
      redemption_request_id: "req-1",
      settlement_amount: 95,
      settlement_asset: "CAD",
      status: "confirmed",
    });
    expect(h.assertAdminOrOperatorMock).toHaveBeenCalledTimes(1);
  });
});
