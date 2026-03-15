/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const resolveActiveAppContextMock = vi.hoisted(() => vi.fn());

vi.mock("../_shared/auth.ts", () => ({
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveActiveAppContext: resolveActiveAppContextMock,
  resolveAppContextInput: vi.fn((req: Request) => ({
    appSlug: req.headers.get("x-app-slug") ?? "wallet",
    citySlug: req.headers.get("x-city-slug") ?? "tcoin",
    environment: req.headers.get("x-app-environment") ?? "development",
  })),
}));

import { handleRequest } from "./index";

describe("citycoin-market handleRequest", () => {
  const maybeSingleMock = vi.fn();
  const limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqMock = vi.fn(() => ({ limit: limitMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockReset();
    limitMock.mockClear();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();

    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {
        from: fromMock,
      },
      userRow: { id: 12 },
    });

    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
  });

  it("returns a ready citycoin rate when a current snapshot exists", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, slug: "tcoin", symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          city_slug: "tcoin",
          symbol: "TCOIN",
          rate: "3.41",
          base_currency: "CAD",
          source: "oracle_router",
          observed_at: "2026-03-14T12:00:00.000Z",
          is_stale: false,
        },
        error: null,
      });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/citycoin-market/rate/current?citySlug=tcoin", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        state: "ready",
        citySlug: "tcoin",
        exchangeRate: 3.41,
      })
    );
  });

  it("returns empty when the city exists but no current rate exists", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, slug: "tcoin", symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/citycoin-market/rate/current?citySlug=tcoin", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        state: "empty",
        citySlug: "tcoin",
      })
    );
  });

  it("returns setup_required when the read model is missing", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, slug: "tcoin", symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "relation \"v_citycoin_exchange_rates_current_v1\" does not exist" },
      });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/citycoin-market/rate/current?citySlug=tcoin", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        state: "setup_required",
      })
    );
  });

  it("resolves the city through appContext when no citySlug query is provided", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: selectMock }))
      .mockImplementationOnce(() => ({ select: selectMock }));

    maybeSingleMock
      .mockResolvedValueOnce({
        data: { id: 1, slug: "tcoin", symbol: "TCOIN" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          city_slug: "tcoin",
          symbol: "TCOIN",
          rate: "3.25",
          base_currency: "CAD",
          source: "oracle_router",
          observed_at: "2026-03-14T12:00:00.000Z",
          is_stale: false,
        },
        error: null,
      });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/citycoin-market/rate/current", {
        method: "GET",
        headers: {
          "x-app-slug": "wallet",
          "x-city-slug": "tcoin",
          "x-app-environment": "development",
        },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveActiveAppContextMock).toHaveBeenCalled();
  });

  it("rejects mismatched citySlug and appContext city", async () => {
    const res = await handleRequest(
      new Request("http://localhost/functions/v1/citycoin-market/rate/current?citySlug=tcoin", {
        method: "GET",
        headers: {
          "x-city-slug": "othercoin",
        },
      })
    );

    expect(res.status).toBe(400);
  });
});
