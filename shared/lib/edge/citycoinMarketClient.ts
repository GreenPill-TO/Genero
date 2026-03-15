import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type {
  CitycoinCurrentRateResponse,
  GetCurrentCitycoinRateInput,
} from "./citycoinMarket";

export async function getCurrentCitycoinRate(
  input?: GetCurrentCitycoinRateInput
): Promise<CitycoinCurrentRateResponse> {
  const params = new URLSearchParams();
  if (input?.citySlug) {
    params.set("citySlug", input.citySlug.trim().toLowerCase());
  }

  return invokeEdgeFunction<CitycoinCurrentRateResponse>(
    "citycoin-market",
    `/rate/current${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext ?? (input?.citySlug ? ({ citySlug: input.citySlug } as AppScopeInput) : undefined),
    }
  );
}
