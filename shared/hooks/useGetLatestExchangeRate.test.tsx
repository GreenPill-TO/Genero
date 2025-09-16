/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useControlVariables } from "./useGetLatestExchangeRate";

const createClientMock = vi.hoisted(() => vi.fn());
const matchMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

describe("useControlVariables", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    matchMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockReset();

    selectMock.mockImplementation(() => ({ match: matchMock }));
    fromMock.mockImplementation(() => ({ select: selectMock }));
    createClientMock.mockImplementation(() => ({ from: fromMock }));
  });

  it("returns fetched exchange rate when available", async () => {
    matchMock.mockResolvedValue({ data: [{ value: 7.12 }], error: null });

    const { result } = renderHook(() => useControlVariables());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(createClientMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("control_variables");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(matchMock).toHaveBeenCalledWith({ variable: "exchange_rate" });
    expect(result.current.exchangeRate).toBe(7.12);
    expect(result.current.error).toBeNull();
  });

  it("skips fetching when not running in the browser", async () => {
    const { result } = renderHook(() => useControlVariables({ isBrowser: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.current.exchangeRate).toBe(3.35);
    expect(result.current.error).toBeNull();
  });

  it("captures errors thrown during fetch", async () => {
    const thrownError = new Error("boom");
    matchMock.mockRejectedValue(thrownError);

    const { result } = renderHook(() => useControlVariables());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(thrownError);
  });
});
