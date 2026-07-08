import type { AppScopeInput } from "./types";

export type CitycoinRateState = "ready" | "empty" | "setup_required";

export type GetCurrentCitycoinRateInput = {
  citySlug?: string | null;
  appContext?: AppScopeInput | null;
};

export type CitycoinCurrentRateResponse = {
  state: CitycoinRateState;
  citySlug: string;
  symbol: string;
  exchangeRate: number | null;
  baseCurrency: "CAD";
  source: string | null;
  observedAt: string | null;
  isStale: boolean;
  setupMessage: string | null;
};
