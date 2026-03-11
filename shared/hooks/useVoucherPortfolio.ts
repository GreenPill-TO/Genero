"use client";

import { useCallback, useEffect, useState } from "react";
import type { VoucherPortfolio } from "@shared/lib/vouchers/types";

export function useVoucherPortfolio(options?: { citySlug?: string; enabled?: boolean }) {
  const citySlug = options?.citySlug ?? "tcoin";
  const enabled = options?.enabled ?? true;

  const [portfolio, setPortfolio] = useState<VoucherPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vouchers/portfolio?citySlug=${encodeURIComponent(citySlug)}`, {
        credentials: "include",
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Failed to load voucher portfolio.");
      }

      setPortfolio((body?.portfolio ?? null) as VoucherPortfolio | null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load voucher portfolio.";
      setError(message);
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [citySlug, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    portfolio,
    loading,
    error,
    refresh,
  };
}
