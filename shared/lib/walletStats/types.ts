export type WalletStatsOverview = {
  userCount: number;
  walletCount: number;
  transactionCount: number;
  transactionVolume: number;
  openPaymentRequestCount: number;
  indexedTcoinBalance: number;
  indexedVoucherBalance: number;
  merchantCommitmentsIssued: number;
  requiredLiquidityAbsolute: number;
  currentExchangeRate: number | null;
  exchangeRateFreshnessSeconds: number | null;
  exchangeRateSource: string | null;
  exchangeRateObservedAt: string | null;
  exchangeRateIsStale: boolean | null;
};

export type WalletStatsTimeseriesPoint = {
  date: string;
  count: number;
  volume: number;
};

export type WalletStatsPaymentRequestPoint = {
  date: string;
  createdCount: number;
  paidCount: number;
};

export type WalletStatsExchangeRatePoint = {
  observedAt: string;
  rate: number;
  source: string | null;
  usedFallback: boolean;
};

export type WalletStatsBiaRow = {
  biaId: string;
  code: string;
  name: string;
  activeUsers: number;
  activeStores: number;
  indexedEventCount: number;
  purchaseCount: number;
  purchasedTokenVolume: number;
  pendingRedemptionCount: number;
  pendingRedemptionVolume: number;
  stressLevel: string;
  redemptionPressure: number;
  lastIndexedBlock: number | null;
};

export type WalletStatsTransactionCategoryRow = {
  category: string;
  count: number;
  volume: number;
};

export type WalletStatsAssetBalanceRow = {
  assetType: "tcoin" | "voucher";
  label: string;
  value: number;
};

export type WalletStatsOps = {
  indexer: {
    lastRunStatus: string | null;
    lastCompletedAt: string | null;
    activePoolCount: number;
    activeTokenCount: number;
    trackedPoolCount: number;
    healthyTrackedPoolCount: number;
    cplTcoinTracked: boolean;
    trackedVoucherTokens: number;
    walletsWithVoucherBalances: number;
    lastVoucherBlock: number | null;
  };
  reserveRouteHealth: {
    reserveAssetActive: boolean | null;
    mentoUsdcRouteConfigured: boolean | null;
    liquidityRouterPointerHealthy: boolean | null;
    treasuryControllerPointerHealthy: boolean | null;
  };
  rate: {
    source: string | null;
    observedAt: string | null;
    freshnessSeconds: number | null;
    isStale: boolean | null;
    usedFallback: boolean | null;
  };
};

export type WalletStatsSummary = {
  generatedAt: string;
  overview: WalletStatsOverview;
  timeseries: {
    dailyTransactions: WalletStatsTimeseriesPoint[];
    dailyPaymentRequests: WalletStatsPaymentRequestPoint[];
    recentExchangeRates: WalletStatsExchangeRatePoint[];
  };
  breakdowns: {
    biaLeaderboard: WalletStatsBiaRow[];
    transactionCategories: WalletStatsTransactionCategoryRow[];
    assetBalances: WalletStatsAssetBalanceRow[];
    biaHealth: WalletStatsBiaRow[];
  };
  ops: WalletStatsOps;
};
