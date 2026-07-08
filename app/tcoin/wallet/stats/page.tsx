"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import {
  WalletPageIntro,
  walletMetricTileClass,
  walletPageClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletRailPageClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";
import { useRouter } from "next/navigation";
import { Button } from "@shared/components/ui/Button";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@shared/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { WalletStatsAssetBalanceRow, WalletStatsBiaRow, WalletStatsSummary } from "@shared/lib/walletStats/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-CA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrencyLike(value: number, suffix = "TCOIN") {
  return `${formatNumber(value)} ${suffix}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatDayLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={walletMetricTileClass}>
      <p className={walletSectionLabelClass}>{label}</p>
      <div className="mt-3 space-y-1">
        <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</p>
        {note ? <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{note}</p> : null}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>;
}

function AssetBreakdownList({ rows }: { rows: WalletStatsAssetBalanceRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel message="No indexed asset balances are available yet." />;
  }

  const maxValue = Math.max(...rows.map((row) => row.value), 0);

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const width = maxValue > 0 ? `${(row.value / maxValue) * 100}%` : "0%";

        return (
          <div key={row.assetType} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{row.label}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{formatCurrencyLike(row.value)}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BiaTable({ rows }: { rows: WalletStatsBiaRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel message="No BIA rollups have been indexed yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200/70 dark:border-white/10">
            <th className="px-0 py-3 font-medium text-slate-500 dark:text-slate-300">BIA</th>
            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-300">Users</th>
            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-300">Stores</th>
            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-300">Events</th>
            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-300">Pending redeems</th>
            <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-300">Stress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.biaId} className="border-b border-slate-200/50 dark:border-white/10 last:border-b-0">
              <td className="px-0 py-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                    {row.code}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatNumber(row.activeUsers)}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatNumber(row.activeStores)}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCompactNumber(row.indexedEventCount)}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatNumber(row.pendingRedemptionCount)}</td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200 capitalize">{row.stressLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function fetchStatsSummary(): Promise<WalletStatsSummary> {
  const response = await fetch("/api/tcoin/stats/summary", {
    credentials: "include",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "Failed to load stats.");
  }

  return body as WalletStatsSummary;
}

export default function StatsForNerdsPage() {
  const { isLoading, isAuthenticated, error } = useAuth();
  const { bootstrap } = useUserSettings({ enabled: isAuthenticated });
  const [summary, setSummary] = useState<WalletStatsSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const router = useRouter();

  const mainClass = cn(walletPageClass, walletRailPageClass, "font-sans min-h-screen text-foreground");
  const experienceMode = bootstrap?.preferences.experienceMode ?? "advanced";

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      setSummary(null);
      setSummaryError("Sign in to load shared wallet stats.");
      return;
    }

    let isMounted = true;
    setIsLoadingSummary(true);
    setSummaryError(null);

    void fetchStatsSummary()
      .then((nextSummary) => {
        if (isMounted) {
          setSummary(nextSummary);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setSummaryError(
            requestError instanceof Error ? requestError.message : "Failed to load wallet stats."
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSummary(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isLoading]);

  const transactionChartData = useMemo(
    () =>
      (summary?.timeseries.dailyTransactions ?? []).map((point) => ({
        ...point,
        label: formatDayLabel(point.date),
      })),
    [summary]
  );

  const paymentRequestChartData = useMemo(
    () =>
      (summary?.timeseries.dailyPaymentRequests ?? []).map((point) => ({
        ...point,
        label: formatDayLabel(point.date),
      })),
    [summary]
  );

  const exchangeRateChartData = useMemo(
    () =>
      (summary?.timeseries.recentExchangeRates ?? []).map((point) => ({
        ...point,
        label: formatDayLabel(point.observedAt.slice(0, 10)),
      })),
    [summary]
  );

  const handleTabChange = (next: string) => {
    if (next === "home") {
      router.push("/dashboard");
      return;
    }
    router.push(`/dashboard?tab=${encodeURIComponent(next)}`);
  };

  if (error) {
    return (
      <div className={mainClass}>
        <Alert variant="destructive">
          <AlertTitle>Could not load your wallet session</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <DashboardFooter active="more" onChange={handleTabChange} experienceMode={experienceMode} />
      </div>
    );
  }

  return (
    <div className={mainClass}>
      <WalletPageIntro
        eyebrow="Read-only analytics"
        title="Stats for Nerds"
        description="A compact view of wallet, market, BIA, and indexer telemetry built from existing TCOIN data sources."
        actions={
          <Button type="button" variant="outline" className="rounded-full" onClick={() => router.push("/dashboard?tab=more")}>
            Back to More
          </Button>
        }
      />

      <section className={walletPanelClass}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={walletSectionLabelClass}>Last updated</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {summary ? formatDateTime(summary.generatedAt) : "Waiting for stats…"}
            </p>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Metrics derived from indexer snapshots are labelled as indexed or approximate rather than canonical on-chain truth.
          </p>
        </div>
      </section>

      {summaryError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load stats</AlertTitle>
          <AlertDescription>{summaryError}</AlertDescription>
        </Alert>
      ) : null}

      {isLoadingSummary && !summary ? (
        <section className={walletPanelClass}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading wallet network stats…</p>
        </section>
      ) : null}

      {summary ? (
        <>
          <section className={walletPanelClass}>
            <div className="space-y-2">
              <p className={walletSectionLabelClass}>Overview</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                What the network looks like right now
              </h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatTile label="Wallet count" value={formatCompactNumber(summary.overview.walletCount)} />
              <StatTile label="User count" value={formatCompactNumber(summary.overview.userCount)} />
              <StatTile
                label="Transaction count"
                value={formatCompactNumber(summary.overview.transactionCount)}
                note={`${formatCurrencyLike(summary.overview.transactionVolume)} moved`}
              />
              <StatTile
                label="Open payment requests"
                value={formatCompactNumber(summary.overview.openPaymentRequestCount)}
              />
              <StatTile
                label="Indexed circulating TCOIN"
                value={formatCurrencyLike(summary.overview.indexedTcoinBalance)}
              />
              <StatTile
                label="Indexed voucher value"
                value={formatCurrencyLike(summary.overview.indexedVoucherBalance)}
              />
              <StatTile
                label="Merchant commitments"
                value={formatCurrencyLike(summary.overview.merchantCommitmentsIssued)}
                note={`Required liquidity: ${formatCurrencyLike(summary.overview.requiredLiquidityAbsolute)}`}
              />
              <StatTile
                label="Current exchange rate"
                value={
                  summary.overview.currentExchangeRate == null
                    ? "Unavailable"
                    : `${formatNumber(summary.overview.currentExchangeRate)} CAD`
                }
                note={
                  summary.overview.exchangeRateSource
                    ? `${summary.overview.exchangeRateSource} · ${
                        summary.overview.exchangeRateIsStale ? "stale" : "fresh"
                      }`
                    : "No current rate source"
                }
              />
              <StatTile
                label="Rate freshness"
                value={
                  summary.overview.exchangeRateFreshnessSeconds == null
                    ? "Unavailable"
                    : `${formatCompactNumber(summary.overview.exchangeRateFreshnessSeconds)}s`
                }
                note={
                  summary.overview.exchangeRateObservedAt
                    ? `Observed ${formatDateTime(summary.overview.exchangeRateObservedAt)}`
                    : "No recent observation"
                }
              />
            </div>
          </section>

          <section className={walletPanelClass}>
            <div className="space-y-2">
              <p className={walletSectionLabelClass}>Slices over time</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                Activity, requests, and recent rate movement
              </h2>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Daily transactions</p>
                <div className="mt-4">
                  <ChartContainer
                    config={{
                      count: { label: "Transactions", color: "#0f766e" },
                      volume: { label: "Volume", color: "#14b8a6" },
                    }}
                    className="h-[18rem] w-full"
                  >
                    <BarChart data={transactionChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={44} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Daily payment requests</p>
                <div className="mt-4">
                  <ChartContainer
                    config={{
                      createdCount: { label: "Created", color: "#2563eb" },
                      paidCount: { label: "Paid", color: "#8b5cf6" },
                    }}
                    className="h-[18rem] w-full"
                  >
                    <AreaChart data={paymentRequestChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={44} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="createdCount"
                        stroke="var(--color-createdCount)"
                        fill="var(--color-createdCount)"
                        fillOpacity={0.18}
                      />
                      <Area
                        type="monotone"
                        dataKey="paidCount"
                        stroke="var(--color-paidCount)"
                        fill="var(--color-paidCount)"
                        fillOpacity={0.14}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>

              <div className={cn(walletPanelMutedClass, "xl:col-span-2")}>
                <p className={walletSectionLabelClass}>Recent exchange rates</p>
                <div className="mt-4">
                  <ChartContainer
                    config={{
                      rate: { label: "Rate", color: "#ea580c" },
                    }}
                    className="h-[18rem] w-full"
                  >
                    <LineChart data={exchangeRateChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={44} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="var(--color-rate)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </div>
            </div>
          </section>

          <section className={walletPanelClass}>
            <div className="space-y-2">
              <p className={walletSectionLabelClass}>Breakdowns</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                Where activity and value are concentrated
              </h2>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>BIA leaderboard</p>
                <div className="mt-4">
                  <BiaTable rows={summary.breakdowns.biaLeaderboard} />
                </div>
              </div>

              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Transaction categories</p>
                <div className="mt-4 space-y-3">
                  {summary.breakdowns.transactionCategories.length > 0 ? (
                    summary.breakdowns.transactionCategories.slice(0, 8).map((row) => (
                      <div key={row.category} className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-950 dark:text-white">{row.category}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            {formatCompactNumber(row.count)} transfers
                          </p>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{formatCurrencyLike(row.volume)}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyPanel message="No transaction categories have been recorded yet." />
                  )}
                </div>
              </div>

              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Indexed asset balances</p>
                <div className="mt-4">
                  <AssetBreakdownList rows={summary.breakdowns.assetBalances} />
                </div>
              </div>
            </div>

            <div className={cn(walletPanelMutedClass, "mt-4")}>
              <p className={walletSectionLabelClass}>BIA health table</p>
              <div className="mt-4">
                <BiaTable rows={summary.breakdowns.biaHealth} />
              </div>
            </div>
          </section>

          <section className={walletPanelClass}>
            <div className="space-y-2">
              <p className={walletSectionLabelClass}>Ops diagnostics</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                Indexer and contract health at a glance
              </h2>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Indexer</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Last run status</dt>
                    <dd className="font-medium text-slate-950 dark:text-white capitalize">
                      {summary.ops.indexer.lastRunStatus ?? "Unknown"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Tracked pools</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {formatNumber(summary.ops.indexer.trackedPoolCount)} total /{" "}
                      {formatNumber(summary.ops.indexer.healthyTrackedPoolCount)} healthy
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Indexed voucher tokens</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {formatNumber(summary.ops.indexer.trackedVoucherTokens)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Wallets with voucher balances</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {formatNumber(summary.ops.indexer.walletsWithVoucherBalances)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Last voucher block</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.indexer.lastVoucherBlock == null
                        ? "Unavailable"
                        : formatCompactNumber(summary.ops.indexer.lastVoucherBlock)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={walletPanelMutedClass}>
                <p className={walletSectionLabelClass}>Contracts and rate</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Reserve asset active</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.reserveRouteHealth.reserveAssetActive == null
                        ? "Unknown"
                        : summary.ops.reserveRouteHealth.reserveAssetActive
                          ? "Yes"
                          : "No"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Mento route configured</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.reserveRouteHealth.mentoUsdcRouteConfigured == null
                        ? "Unknown"
                        : summary.ops.reserveRouteHealth.mentoUsdcRouteConfigured
                          ? "Yes"
                          : "No"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Liquidity pointer health</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.reserveRouteHealth.liquidityRouterPointerHealthy == null
                        ? "Unknown"
                        : summary.ops.reserveRouteHealth.liquidityRouterPointerHealthy
                          ? "Healthy"
                          : "Mismatch"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Treasury pointer health</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.reserveRouteHealth.treasuryControllerPointerHealthy == null
                        ? "Unknown"
                        : summary.ops.reserveRouteHealth.treasuryControllerPointerHealthy
                          ? "Healthy"
                          : "Mismatch"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Rate source</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {summary.ops.rate.source ?? "Unavailable"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600 dark:text-slate-300">Rate observation</dt>
                    <dd className="font-medium text-slate-950 dark:text-white">
                      {formatDateTime(summary.ops.rate.observedAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <DashboardFooter active="more" onChange={handleTabChange} experienceMode={experienceMode} />
    </div>
  );
}
