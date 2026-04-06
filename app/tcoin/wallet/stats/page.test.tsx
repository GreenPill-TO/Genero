/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletStatsSummary } from "@shared/lib/walletStats/types";

const useAuthMock = vi.hoisted(() => vi.fn());
const useUserSettingsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@tcoin/wallet/components/DashboardFooter", () => ({
  DashboardFooter: () => <div data-testid="dashboard-footer" />,
}));

vi.mock("@shared/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("recharts", () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Area: () => null,
    AreaChart: MockChart,
    Bar: () => null,
    BarChart: MockChart,
    CartesianGrid: () => null,
    Line: () => null,
    LineChart: MockChart,
    XAxis: () => null,
    YAxis: () => null,
  };
});

import StatsForNerdsPage from "./page";

const createSummary = (overrides: Partial<WalletStatsSummary> = {}): WalletStatsSummary => ({
  generatedAt: "2026-04-03T12:00:00.000Z",
  overview: {
    userCount: 12,
    walletCount: 8,
    transactionCount: 44,
    transactionVolume: 1400,
    openPaymentRequestCount: 3,
    indexedTcoinBalance: 2000,
    indexedVoucherBalance: 150,
    merchantCommitmentsIssued: 320,
    requiredLiquidityAbsolute: 140,
    currentExchangeRate: 3.35,
    exchangeRateFreshnessSeconds: 120,
    exchangeRateSource: "oracle",
    exchangeRateObservedAt: "2026-04-03T11:58:00.000Z",
    exchangeRateIsStale: false,
  },
  timeseries: {
    dailyTransactions: [{ date: "2026-04-03", count: 4, volume: 100 }],
    dailyPaymentRequests: [{ date: "2026-04-03", createdCount: 2, paidCount: 1 }],
    recentExchangeRates: [
      { observedAt: "2026-04-03T11:58:00.000Z", rate: 3.35, source: "oracle", usedFallback: false },
    ],
  },
  breakdowns: {
    biaLeaderboard: [
      {
        biaId: "bia-1",
        code: "DTA",
        name: "Downtown",
        activeUsers: 12,
        activeStores: 4,
        indexedEventCount: 50,
        purchaseCount: 5,
        purchasedTokenVolume: 100,
        pendingRedemptionCount: 1,
        pendingRedemptionVolume: 4,
        stressLevel: "low",
        redemptionPressure: 0.1,
        lastIndexedBlock: 123,
      },
    ],
    transactionCategories: [{ category: "transfer", count: 20, volume: 900 }],
    assetBalances: [
      { assetType: "tcoin", label: "Indexed TCOIN", value: 2000 },
      { assetType: "voucher", label: "Indexed vouchers", value: 150 },
    ],
    biaHealth: [
      {
        biaId: "bia-1",
        code: "DTA",
        name: "Downtown",
        activeUsers: 12,
        activeStores: 4,
        indexedEventCount: 50,
        purchaseCount: 5,
        purchasedTokenVolume: 100,
        pendingRedemptionCount: 1,
        pendingRedemptionVolume: 4,
        stressLevel: "low",
        redemptionPressure: 0.1,
        lastIndexedBlock: 123,
      },
    ],
  },
  ops: {
    indexer: {
      lastRunStatus: "ok",
      lastCompletedAt: "2026-04-03T11:59:00.000Z",
      activePoolCount: 3,
      activeTokenCount: 2,
      trackedPoolCount: 4,
      healthyTrackedPoolCount: 3,
      cplTcoinTracked: true,
      trackedVoucherTokens: 7,
      walletsWithVoucherBalances: 12,
      lastVoucherBlock: 555,
    },
    reserveRouteHealth: {
      reserveAssetActive: true,
      mentoUsdcRouteConfigured: true,
      liquidityRouterPointerHealthy: true,
      treasuryControllerPointerHealthy: true,
    },
    rate: {
      source: "oracle",
      observedAt: "2026-04-03T11:58:00.000Z",
      freshnessSeconds: 120,
      isStale: false,
      usedFallback: false,
    },
  },
  ...overrides,
});

function createFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn(async () => body),
  };
}

describe("StatsForNerdsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "advanced",
        },
      },
    });
    fetchMock.mockResolvedValue(createFetchResponse(createSummary()));
    pushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the stats page headings and loads the aggregated summary", async () => {
    render(<StatsForNerdsPage />);

    expect(screen.getByRole("heading", { name: /Stats for Nerds/i })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/What the network looks like right now/i)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/tcoin/stats/summary", {
      credentials: "include",
    });
    expect(screen.getByText(/Activity, requests, and recent rate movement/i)).toBeTruthy();
    expect(screen.getByText(/Indexer and contract health at a glance/i)).toBeTruthy();
    expect(screen.getByTestId("dashboard-footer")).toBeTruthy();
  });

  it("shows empty-state messaging when the summary payload is sparse", async () => {
    fetchMock.mockResolvedValue(
      createFetchResponse(
        createSummary({
          overview: {
            ...createSummary().overview,
            currentExchangeRate: null,
            exchangeRateFreshnessSeconds: null,
            exchangeRateSource: null,
            exchangeRateObservedAt: null,
            exchangeRateIsStale: null,
          },
          breakdowns: {
            biaLeaderboard: [],
            transactionCategories: [],
            assetBalances: [],
            biaHealth: [],
          },
        })
      )
    );

    render(<StatsForNerdsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No indexed asset balances are available yet\./i)).toBeTruthy();
    });

    expect(screen.getAllByText(/No BIA rollups have been indexed yet\./i)).toHaveLength(2);
    expect(screen.getByText(/No transaction categories have been recorded yet\./i)).toBeTruthy();
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
  });

  it("routes back to More from the page intro action", async () => {
    render(<StatsForNerdsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Back to More/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Back to More/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard?tab=more");
  });
});
