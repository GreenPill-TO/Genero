import { useEffect, useState } from "react";
import { getCurrentCitycoinRate } from "@shared/lib/edge/citycoinMarketClient";
import { resolveAppScope } from "@shared/lib/edge/appScope";
import type { CitycoinRateState } from "@shared/lib/edge/citycoinMarket";

export const DEFAULT_FALLBACK_EXCHANGE_RATE = 3.35;

export function resolveFallbackExchangeRate() {
  const configuredRate = Number.parseFloat(
    process.env.NEXT_PUBLIC_CITYCOIN_CAD_FALLBACK_RATE ?? ""
  );

  if (Number.isFinite(configuredRate) && configuredRate > 0) {
    return configuredRate;
  }

  return DEFAULT_FALLBACK_EXCHANGE_RATE;
}

export function getExchangeRateFallbackMessage(state: CitycoinRateState) {
  switch (state) {
    case "empty":
      return "No current TCOIN/CAD rate has been published yet.";
    case "setup_required":
      return "Exchange-rate infrastructure is not configured in this environment.";
    case "ready":
    default:
      return null;
  }
}

interface UseControlVariablesOptions {
  isBrowser?: boolean;
  citySlug?: string | null;
}

export function useControlVariables(options?: UseControlVariablesOptions) {
  const isBrowser = options?.isBrowser ?? typeof window !== "undefined";
  const [state, setState] = useState<CitycoinRateState>("empty");
  const [exchangeRate, setExchangeRate] = useState<number>(() => resolveFallbackExchangeRate());
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(isBrowser);
  const fallbackExchangeRate = resolveFallbackExchangeRate();
  const fallbackMessage = getExchangeRateFallbackMessage(state);

  useEffect(() => {
    let isActive = true;

    async function fetchExchangeRate() {
      const nextFallbackExchangeRate = resolveFallbackExchangeRate();

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
            : nextFallbackExchangeRate
        );
        setError(null);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setState("setup_required");
        setExchangeRate(nextFallbackExchangeRate);
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

  return {
    exchangeRate,
    state,
    error,
    loading,
    fallbackExchangeRate,
    fallbackMessage,
    isFallbackRate: fallbackMessage !== null,
  };
}
