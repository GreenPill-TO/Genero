/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentCitycoinRateMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/edge/citycoinMarketClient", () => ({
  getCurrentCitycoinRate: getCurrentCitycoinRateMock,
}));

import { useControlVariables } from "./useGetLatestExchangeRate";

describe("useControlVariables", () => {
  beforeEach(() => {
    getCurrentCitycoinRateMock.mockReset();
  });

  it("returns fetched exchange rate when available", async () => {
    getCurrentCitycoinRateMock.mockResolvedValue({
      state: "ready",
      citySlug: "tcoin",
      symbol: "TCOIN",
      exchangeRate: 7.12,
      baseCurrency: "CAD",
      source: "oracle_router",
      observedAt: "2026-03-14T10:00:00.000Z",
      isStale: false,
      setupMessage: null,
    });

    const { result } = renderHook(() => useControlVariables());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCurrentCitycoinRateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        citySlug: "tcoin",
      })
    );
    expect(result.current.exchangeRate).toBe(7.12);
    expect(result.current.state).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("returns the fallback exchange rate when the city rate is empty", async () => {
    getCurrentCitycoinRateMock.mockResolvedValue({
      state: "empty",
      citySlug: "tcoin",
      symbol: "TCOIN",
      exchangeRate: null,
      baseCurrency: "CAD",
      source: null,
      observedAt: null,
      isStale: true,
      setupMessage: null,
    });

    const { result } = renderHook(() => useControlVariables());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.exchangeRate).toBe(3.35);
    expect(result.current.state).toBe("empty");
  });

  it("skips fetching when not running in the browser", async () => {
    const { result } = renderHook(() => useControlVariables({ isBrowser: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCurrentCitycoinRateMock).not.toHaveBeenCalled();
    expect(result.current.exchangeRate).toBe(3.35);
    expect(result.current.state).toBe("empty");
    expect(result.current.error).toBeNull();
  });

  it("captures errors thrown during fetch as setup-required state", async () => {
    const thrownError = new Error("boom");
    getCurrentCitycoinRateMock.mockRejectedValue(thrownError);

    const { result } = renderHook(() => useControlVariables());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.exchangeRate).toBe(3.35);
    expect(result.current.state).toBe("setup_required");
    expect(result.current.error).toBe(thrownError);
  });
});
