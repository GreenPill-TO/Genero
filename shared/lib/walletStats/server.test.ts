/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/contracts/torontocoinOps", () => ({
  getTorontoCoinOpsStatus: vi.fn(),
}));

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  TORONTOCOIN_RUNTIME: { chainId: 42220 },
}));

vi.mock("@services/indexer/src", () => ({
  getIndexerScopeStatus: vi.fn(),
}));

vi.mock("@shared/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { buildWalletStatsSummary, type WalletStatsSummarySnapshot } from "./server";

function createSnapshot(
  overrides: Partial<WalletStatsSummarySnapshot> = {}
): WalletStatsSummarySnapshot {
  return {
    generatedAt: "2026-04-03T12:00:00.000Z",
    userCount: 12,
    walletCount: 8,
    transactionRows: [],
    paymentRequestRows: [],
    currentRateRow: null,
    exchangeRateHistoryRows: [],
    biaActivityRows: [],
    biaHealthRows: [],
    walletTcoinBalanceRows: [],
    walletVoucherBalanceRows: [],
    merchantCreditRows: [],
    indexerStatus: null,
    torontoCoinOpsStatus: null,
    ...overrides,
  };
}

describe("buildWalletStatsSummary", () => {
  it("aggregates overview totals from the supplied snapshot", () => {
    const summary = buildWalletStatsSummary(
      createSnapshot({
        transactionRows: [
          { created_at: "2026-04-02T10:00:00.000Z", amount: "10", transaction_category: "purchase", currency: "TCOIN" },
          { created_at: "2026-04-02T12:00:00.000Z", amount: "25", transaction_category: "transfer", currency: "TCOIN" },
          { created_at: "2026-04-03T09:00:00.000Z", amount: "5", transaction_category: "purchase", currency: "TCOIN" },
        ],
        paymentRequestRows: [
          { created_at: "2026-04-02T08:00:00.000Z", paid_at: null, status: "pending" },
          { created_at: "2026-04-02T09:00:00.000Z", paid_at: "2026-04-03T09:05:00.000Z", status: "paid" },
        ],
        currentRateRow: {
          citycoin_id: "1",
          rate: "3.35",
          source: "oracle",
          observed_at: "2026-04-03T11:55:00.000Z",
          freshness_seconds: "90",
          is_stale: false,
          used_fallback: false,
        },
        walletTcoinBalanceRows: [{ balance: "12.5" }, { balance: 7.5 }],
        walletVoucherBalanceRows: [{ balance: "3" }],
        merchantCreditRows: [
          { credit_issued: "100", required_liquidity_absolute: "40" },
          { credit_issued: "50", required_liquidity_absolute: "20" },
        ],
      })
    );

    expect(summary.overview.userCount).toBe(12);
    expect(summary.overview.walletCount).toBe(8);
    expect(summary.overview.transactionCount).toBe(3);
    expect(summary.overview.transactionVolume).toBe(40);
    expect(summary.overview.openPaymentRequestCount).toBe(1);
    expect(summary.overview.indexedTcoinBalance).toBe(20);
    expect(summary.overview.indexedVoucherBalance).toBe(3);
    expect(summary.overview.merchantCommitmentsIssued).toBe(150);
    expect(summary.overview.requiredLiquidityAbsolute).toBe(60);
    expect(summary.overview.currentExchangeRate).toBe(3.35);
    expect(summary.overview.exchangeRateFreshnessSeconds).toBe(90);
    expect(summary.overview.exchangeRateSource).toBe("oracle");
    expect(summary.overview.exchangeRateIsStale).toBe(false);
  });

  it("sorts breakdowns and rate history into stable display order", () => {
    const summary = buildWalletStatsSummary(
      createSnapshot({
        transactionRows: [
          { created_at: "2026-04-01T10:00:00.000Z", amount: "15", transaction_category: "purchase", currency: "TCOIN" },
          { created_at: "2026-04-01T12:00:00.000Z", amount: "25", transaction_category: "transfer", currency: "TCOIN" },
          { created_at: "2026-04-02T09:00:00.000Z", amount: "5", transaction_category: "purchase", currency: "TCOIN" },
        ],
        exchangeRateHistoryRows: [
          { observed_at: "2026-04-03T11:00:00.000Z", rate: "3.40", source: "oracle", used_fallback: false },
          { observed_at: "2026-04-01T11:00:00.000Z", rate: "3.20", source: "oracle", used_fallback: true },
          { observed_at: "2026-04-02T11:00:00.000Z", rate: "3.30", source: "oracle", used_fallback: false },
        ],
        biaActivityRows: [
          {
            bia_id: "bia-1",
            code: "DTA",
            name: "Downtown",
            active_users: "45",
            active_stores: "12",
            indexed_event_count: "120",
            last_indexed_block: "900",
          },
          {
            bia_id: "bia-2",
            code: "WLV",
            name: "West Loop",
            active_users: "30",
            active_stores: "8",
            indexed_event_count: "80",
            last_indexed_block: "890",
          },
        ],
        biaHealthRows: [
          {
            bia_id: "bia-1",
            code: "DTA",
            name: "Downtown",
            purchase_count: "20",
            purchased_token_volume: "70",
            pending_redemption_count: "3",
            pending_redemption_volume: "9",
            indexed_events: "120",
            redemption_pressure: "0.2",
            stress_level: "medium",
            last_indexed_block: "900",
          },
          {
            bia_id: "bia-2",
            code: "WLV",
            name: "West Loop",
            purchase_count: "14",
            purchased_token_volume: "45",
            pending_redemption_count: "4",
            pending_redemption_volume: "12",
            indexed_events: "80",
            redemption_pressure: "0.4",
            stress_level: "high",
            last_indexed_block: "890",
          },
        ],
      })
    );

    expect(summary.breakdowns.transactionCategories.map((row) => row.category)).toEqual([
      "transfer",
      "purchase",
    ]);
    expect(summary.breakdowns.biaLeaderboard.map((row) => row.biaId)).toEqual([
      "bia-1",
      "bia-2",
    ]);
    expect(summary.breakdowns.biaHealth[0]?.stressLevel).toBe("medium");
    expect(summary.timeseries.recentExchangeRates.map((row) => row.observedAt)).toEqual([
      "2026-04-01T11:00:00.000Z",
      "2026-04-02T11:00:00.000Z",
      "2026-04-03T11:00:00.000Z",
    ]);
    expect(summary.timeseries.recentExchangeRates[0]?.usedFallback).toBe(true);
  });

  it("degrades empty snapshots to zeroed summaries and empty breakdowns", () => {
    const summary = buildWalletStatsSummary(createSnapshot());

    expect(summary.overview.transactionCount).toBe(0);
    expect(summary.overview.transactionVolume).toBe(0);
    expect(summary.overview.currentExchangeRate).toBeNull();
    expect(summary.breakdowns.transactionCategories).toEqual([]);
    expect(summary.breakdowns.biaLeaderboard).toEqual([]);
    expect(summary.breakdowns.assetBalances.map((row) => row.value)).toEqual([0, 0]);
    expect(summary.timeseries.dailyTransactions).toHaveLength(30);
    expect(summary.timeseries.dailyPaymentRequests).toHaveLength(30);
  });
});
