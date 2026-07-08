import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { type TorontoCoinOpsCoreStatus } from "@shared/lib/contracts/torontocoinOps";
import { TORONTOCOIN_RUNTIME } from "@shared/lib/contracts/torontocoinRuntime";
import type { IndexerScopeStatus } from "@shared/lib/indexer/types";
import type {
  WalletStatsAssetBalanceRow,
  WalletStatsBiaRow,
  WalletStatsExchangeRatePoint,
  WalletStatsOps,
  WalletStatsPaymentRequestPoint,
  WalletStatsSummary,
  WalletStatsTimeseriesPoint,
  WalletStatsTransactionCategoryRow,
} from "./types";

const CITY_SLUG = "tcoin";
const CHAIN_ID = TORONTOCOIN_RUNTIME.chainId;
const DAILY_WINDOW_DAYS = 30;

type TransactionRow = {
  created_at: string | null;
  amount: number | string | null;
  transaction_category: string | null;
  currency: string | null;
};

type PaymentRequestRow = {
  created_at: string | null;
  paid_at: string | null;
  status: string | null;
};

type CurrentExchangeRateRow = {
  citycoin_id: number | string | null;
  rate: number | string | null;
  source: string | null;
  observed_at: string | null;
  freshness_seconds: number | string | null;
  is_stale: boolean | null;
  used_fallback: boolean | null;
};

type ExchangeRateHistoryRow = {
  observed_at: string | null;
  rate: number | string | null;
  source: string | null;
  used_fallback: boolean | null;
};

type BiaActivityRow = {
  bia_id: string | null;
  code: string | null;
  name: string | null;
  active_users: number | string | null;
  active_stores: number | string | null;
  indexed_event_count: number | string | null;
  last_indexed_block: number | string | null;
};

type BiaHealthRow = {
  bia_id: string | null;
  code: string | null;
  name: string | null;
  purchase_count: number | string | null;
  purchased_token_volume: number | string | null;
  pending_redemption_count: number | string | null;
  pending_redemption_volume: number | string | null;
  indexed_events: number | string | null;
  redemption_pressure: number | string | null;
  stress_level: string | null;
  last_indexed_block: number | string | null;
};

type BalanceRow = {
  balance: number | string | null;
};

type MerchantCreditRow = {
  credit_issued: number | string | null;
  required_liquidity_absolute: number | string | null;
};

export type WalletStatsSummarySnapshot = {
  generatedAt: string;
  userCount: number;
  walletCount: number;
  transactionRows: TransactionRow[];
  paymentRequestRows: PaymentRequestRow[];
  currentRateRow: CurrentExchangeRateRow | null;
  exchangeRateHistoryRows: ExchangeRateHistoryRow[];
  biaActivityRows: BiaActivityRow[];
  biaHealthRows: BiaHealthRow[];
  walletTcoinBalanceRows: BalanceRow[];
  walletVoucherBalanceRows: BalanceRow[];
  merchantCreditRows: MerchantCreditRow[];
  indexerStatus: IndexerScopeStatus | null;
  torontoCoinOpsStatus: TorontoCoinOpsCoreStatus | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNullableInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed !== 0 ? Math.trunc(parsed) : parsed === 0 ? 0 : null;
}

function normaliseDateKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildDailyWindow(days: number, generatedAt: string) {
  const end = new Date(generatedAt);
  const points: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const point = new Date(end);
    point.setUTCDate(point.getUTCDate() - offset);
    points.push(point.toISOString().slice(0, 10));
  }

  return points;
}

function sortBiaRows(rows: WalletStatsBiaRow[]) {
  return [...rows].sort((left, right) => {
    if (right.indexedEventCount !== left.indexedEventCount) {
      return right.indexedEventCount - left.indexedEventCount;
    }
    if (right.activeUsers !== left.activeUsers) {
      return right.activeUsers - left.activeUsers;
    }
    if (right.pendingRedemptionVolume !== left.pendingRedemptionVolume) {
      return right.pendingRedemptionVolume - left.pendingRedemptionVolume;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildDailyTransactionSeries(
  rows: TransactionRow[],
  generatedAt: string
): WalletStatsTimeseriesPoint[] {
  const dateMap = new Map<string, WalletStatsTimeseriesPoint>();
  const dailyWindow = buildDailyWindow(DAILY_WINDOW_DAYS, generatedAt);

  dailyWindow.forEach((date) => {
    dateMap.set(date, { date, count: 0, volume: 0 });
  });

  rows.forEach((row) => {
    const date = normaliseDateKey(row.created_at);
    if (!date || !dateMap.has(date)) {
      return;
    }

    const current = dateMap.get(date)!;
    current.count += 1;
    current.volume += Math.abs(toNumber(row.amount));
  });

  return dailyWindow.map((date) => dateMap.get(date)!);
}

function buildDailyPaymentRequestSeries(
  rows: PaymentRequestRow[],
  generatedAt: string
): WalletStatsPaymentRequestPoint[] {
  const dateMap = new Map<string, WalletStatsPaymentRequestPoint>();
  const dailyWindow = buildDailyWindow(DAILY_WINDOW_DAYS, generatedAt);

  dailyWindow.forEach((date) => {
    dateMap.set(date, { date, createdCount: 0, paidCount: 0 });
  });

  rows.forEach((row) => {
    const createdDate = normaliseDateKey(row.created_at);
    if (createdDate && dateMap.has(createdDate)) {
      dateMap.get(createdDate)!.createdCount += 1;
    }

    const paidDate = normaliseDateKey(row.paid_at);
    if (paidDate && dateMap.has(paidDate)) {
      dateMap.get(paidDate)!.paidCount += 1;
    }
  });

  return dailyWindow.map((date) => dateMap.get(date)!);
}

function buildRecentExchangeRateSeries(
  rows: ExchangeRateHistoryRow[]
): WalletStatsExchangeRatePoint[] {
  return [...rows]
    .filter((row) => row.observed_at)
    .map((row) => ({
      observedAt: row.observed_at as string,
      rate: toNumber(row.rate),
      source: row.source,
      usedFallback: row.used_fallback === true,
    }))
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

function buildTransactionCategoryBreakdown(
  rows: TransactionRow[]
): WalletStatsTransactionCategoryRow[] {
  const categoryMap = new Map<string, WalletStatsTransactionCategoryRow>();

  rows.forEach((row) => {
    const category = row.transaction_category?.trim() || "uncategorized";
    const current = categoryMap.get(category) ?? { category, count: 0, volume: 0 };
    current.count += 1;
    current.volume += Math.abs(toNumber(row.amount));
    categoryMap.set(category, current);
  });

  return Array.from(categoryMap.values()).sort((left, right) => {
    if (right.volume !== left.volume) {
      return right.volume - left.volume;
    }
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.category.localeCompare(right.category);
  });
}

function buildAssetBalanceBreakdown(options: {
  tcoinRows: BalanceRow[];
  voucherRows: BalanceRow[];
}): WalletStatsAssetBalanceRow[] {
  return [
    {
      assetType: "tcoin",
      label: "Indexed TCOIN",
      value: options.tcoinRows.reduce((sum, row) => sum + toNumber(row.balance), 0),
    },
    {
      assetType: "voucher",
      label: "Indexed vouchers",
      value: options.voucherRows.reduce((sum, row) => sum + toNumber(row.balance), 0),
    },
  ];
}

function buildBiaRows(options: {
  activityRows: BiaActivityRow[];
  healthRows: BiaHealthRow[];
}): WalletStatsBiaRow[] {
  const activityById = new Map<string, BiaActivityRow>();
  const healthById = new Map<string, BiaHealthRow>();

  options.activityRows.forEach((row) => {
    if (row.bia_id) {
      activityById.set(row.bia_id, row);
    }
  });

  options.healthRows.forEach((row) => {
    if (row.bia_id) {
      healthById.set(row.bia_id, row);
    }
  });

  const biaIds = new Set<string>([
    ...Array.from(activityById.keys()),
    ...Array.from(healthById.keys()),
  ]);

  return sortBiaRows(
    Array.from(biaIds).map((biaId) => {
      const activity = activityById.get(biaId);
      const health = healthById.get(biaId);

      return {
        biaId,
        code: activity?.code ?? health?.code ?? "n/a",
        name: activity?.name ?? health?.name ?? "Unknown BIA",
        activeUsers: toNumber(activity?.active_users),
        activeStores: toNumber(activity?.active_stores),
        indexedEventCount: toNumber(activity?.indexed_event_count ?? health?.indexed_events),
        purchaseCount: toNumber(health?.purchase_count),
        purchasedTokenVolume: toNumber(health?.purchased_token_volume),
        pendingRedemptionCount: toNumber(health?.pending_redemption_count),
        pendingRedemptionVolume: toNumber(health?.pending_redemption_volume),
        stressLevel: health?.stress_level ?? "low",
        redemptionPressure: toNumber(health?.redemption_pressure),
        lastIndexedBlock: toNullableInteger(activity?.last_indexed_block ?? health?.last_indexed_block),
      };
    })
  );
}

export function buildWalletStatsSummary(
  snapshot: WalletStatsSummarySnapshot
): WalletStatsSummary {
  const transactionCount = snapshot.transactionRows.length;
  const transactionVolume = snapshot.transactionRows.reduce(
    (sum, row) => sum + Math.abs(toNumber(row.amount)),
    0
  );
  const openPaymentRequestCount = snapshot.paymentRequestRows.filter(
    (row) => (row.status ?? "").toLowerCase() === "pending"
  ).length;
  const assetBalances = buildAssetBalanceBreakdown({
    tcoinRows: snapshot.walletTcoinBalanceRows,
    voucherRows: snapshot.walletVoucherBalanceRows,
  });
  const totalMerchantCommitmentsIssued = snapshot.merchantCreditRows.reduce(
    (sum, row) => sum + toNumber(row.credit_issued),
    0
  );
  const totalRequiredLiquidity = snapshot.merchantCreditRows.reduce(
    (sum, row) => sum + toNumber(row.required_liquidity_absolute),
    0
  );
  const biaRows = buildBiaRows({
    activityRows: snapshot.biaActivityRows,
    healthRows: snapshot.biaHealthRows,
  });
  const currentRate = snapshot.currentRateRow;

  const ops: WalletStatsOps = {
    indexer: {
      lastRunStatus: snapshot.indexerStatus?.runControl?.lastStatus ?? null,
      lastCompletedAt: snapshot.indexerStatus?.runControl?.lastCompletedAt ?? null,
      activePoolCount: snapshot.indexerStatus?.activePoolCount ?? 0,
      activeTokenCount: snapshot.indexerStatus?.activeTokenCount ?? 0,
      trackedPoolCount: snapshot.indexerStatus?.torontoCoinTracking?.trackedPools.length ?? 0,
      healthyTrackedPoolCount:
        snapshot.indexerStatus?.torontoCoinTracking?.trackedPools.filter((pool) => pool.healthy).length ?? 0,
      cplTcoinTracked: snapshot.indexerStatus?.torontoCoinTracking?.cplTcoinTracked ?? false,
      trackedVoucherTokens: snapshot.indexerStatus?.voucherSummary.trackedVoucherTokens ?? 0,
      walletsWithVoucherBalances: snapshot.indexerStatus?.voucherSummary.walletsWithVoucherBalances ?? 0,
      lastVoucherBlock: snapshot.indexerStatus?.voucherSummary.lastVoucherBlock ?? null,
    },
    reserveRouteHealth: {
      reserveAssetActive: snapshot.torontoCoinOpsStatus?.reserveRouteHealth.reserveAssetActive ?? null,
      mentoUsdcRouteConfigured:
        snapshot.torontoCoinOpsStatus?.reserveRouteHealth.mentoUsdcRouteConfigured ?? null,
      liquidityRouterPointerHealthy:
        snapshot.torontoCoinOpsStatus?.reserveRouteHealth.liquidityRouterPointerHealthy ?? null,
      treasuryControllerPointerHealthy:
        snapshot.torontoCoinOpsStatus?.reserveRouteHealth.treasuryControllerPointerHealthy ?? null,
    },
    rate: {
      source: currentRate?.source ?? null,
      observedAt: currentRate?.observed_at ?? null,
      freshnessSeconds:
        currentRate?.freshness_seconds == null ? null : toNumber(currentRate.freshness_seconds),
      isStale: currentRate?.is_stale ?? null,
      usedFallback: currentRate?.used_fallback ?? null,
    },
  };

  return {
    generatedAt: snapshot.generatedAt,
    overview: {
      userCount: snapshot.userCount,
      walletCount: snapshot.walletCount,
      transactionCount,
      transactionVolume,
      openPaymentRequestCount,
      indexedTcoinBalance: assetBalances.find((row) => row.assetType === "tcoin")?.value ?? 0,
      indexedVoucherBalance: assetBalances.find((row) => row.assetType === "voucher")?.value ?? 0,
      merchantCommitmentsIssued: totalMerchantCommitmentsIssued,
      requiredLiquidityAbsolute: totalRequiredLiquidity,
      currentExchangeRate: currentRate?.rate == null ? null : toNumber(currentRate.rate),
      exchangeRateFreshnessSeconds:
        currentRate?.freshness_seconds == null ? null : toNumber(currentRate.freshness_seconds),
      exchangeRateSource: currentRate?.source ?? null,
      exchangeRateObservedAt: currentRate?.observed_at ?? null,
      exchangeRateIsStale: currentRate?.is_stale ?? null,
    },
    timeseries: {
      dailyTransactions: buildDailyTransactionSeries(snapshot.transactionRows, snapshot.generatedAt),
      dailyPaymentRequests: buildDailyPaymentRequestSeries(
        snapshot.paymentRequestRows,
        snapshot.generatedAt
      ),
      recentExchangeRates: buildRecentExchangeRateSeries(snapshot.exchangeRateHistoryRows),
    },
    breakdowns: {
      biaLeaderboard: biaRows.slice(0, 6),
      transactionCategories: buildTransactionCategoryBreakdown(snapshot.transactionRows),
      assetBalances,
      biaHealth: biaRows,
    },
    ops,
  };
}

export async function getWalletStatsSummary(
  supabase: SupabaseClient
): Promise<WalletStatsSummary> {
  const { data, error } = await supabase.rpc("wallet_stats_summary_v1", {
    p_city_slug: CITY_SLUG,
    p_chain_id: CHAIN_ID,
  });

  if (error) {
    throw new Error(`Failed to load wallet stats summary: ${error.message}`);
  }

  return data as WalletStatsSummary;
}
