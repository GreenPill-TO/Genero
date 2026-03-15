import { useEffect, useState } from "react";
import { getCurrentCitycoinRate } from "@shared/lib/edge/citycoinMarketClient";
import { resolveAppScope } from "@shared/lib/edge/appScope";
import type { CitycoinRateState } from "@shared/lib/edge/citycoinMarket";

const FALLBACK_EXCHANGE_RATE = 3.35;

interface UseControlVariablesOptions {
  isBrowser?: boolean;
  citySlug?: string | null;
}

export function useControlVariables(options?: UseControlVariablesOptions) {
  const isBrowser = options?.isBrowser ?? typeof window !== "undefined";
  const [state, setState] = useState<CitycoinRateState>("empty");
  const [exchangeRate, setExchangeRate] = useState<number>(FALLBACK_EXCHANGE_RATE);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(isBrowser);

  useEffect(() => {
    let isActive = true;

    async function fetchExchangeRate() {
      try {
        const appContext = resolveAppScope(
          options?.citySlug ? { citySlug: options.citySlug } : undefined
        );
        const response = await getCurrentCitycoinRate({
          citySlug: appContext.citySlug,
          appContext,
        });

        if (!isActive) {
          return;
        }

        setState(response.state);
        setExchangeRate(
          response.state === "ready" &&
            typeof response.exchangeRate === "number" &&
            Number.isFinite(response.exchangeRate) &&
            response.exchangeRate > 0
            ? response.exchangeRate
            : FALLBACK_EXCHANGE_RATE
        );
        setError(null);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setState("setup_required");
        setExchangeRate(FALLBACK_EXCHANGE_RATE);
        setError(caughtError);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    if (!isBrowser) {
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    void fetchExchangeRate();

    return () => {
      isActive = false;
    };
  }, [isBrowser, options?.citySlug]);

  return { exchangeRate, state, error, loading };
}
