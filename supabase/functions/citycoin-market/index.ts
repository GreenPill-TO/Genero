import { resolveAuthenticatedUser } from "../_shared/auth.ts";
import { resolveActiveAppContext, resolveAppContextInput } from "../_shared/appContext.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/responses.ts";

type DenoServe = {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoServe }).Deno;

function isSchemaSetupError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("v_citycoin_exchange_rates_current_v1") ||
    normalized.includes("citycoin_exchange_rates") ||
    normalized.includes("oracle_router")
  );
}

async function resolveCityRate(options: {
  supabase: any;
  citySlug: string;
}) {
  const { data: citycoinRow, error: citycoinError } = await options.supabase
    .from("ref_citycoins")
    .select("id,slug,symbol")
    .eq("slug", options.citySlug)
    .limit(1)
    .maybeSingle();

  if (citycoinError) {
    throw new Error(`Failed to resolve city coin: ${citycoinError.message}`);
  }

  if (!citycoinRow?.id) {
    throw new Error(`City coin '${options.citySlug}' was not found.`);
  }

  const { data: currentRate, error: rateError } = await options.supabase
    .from("v_citycoin_exchange_rates_current_v1")
    .select("city_slug,symbol,rate,base_currency,source,observed_at,is_stale")
    .eq("city_slug", options.citySlug)
    .limit(1)
    .maybeSingle();

  if (rateError) {
    if (isSchemaSetupError(rateError.message)) {
      return {
        state: "setup_required",
        citySlug: options.citySlug,
        symbol: String(citycoinRow.symbol ?? options.citySlug).toUpperCase(),
        exchangeRate: null,
        baseCurrency: "CAD",
        source: null,
        observedAt: null,
        isStale: true,
        setupMessage: "City exchange-rate read models are not configured yet.",
      };
    }

    throw new Error(`Failed to load city exchange rate: ${rateError.message}`);
  }

  if (!currentRate || currentRate.rate == null) {
    return {
      state: "empty",
      citySlug: options.citySlug,
      symbol: String(citycoinRow.symbol ?? options.citySlug).toUpperCase(),
      exchangeRate: null,
      baseCurrency: "CAD",
      source: null,
      observedAt: null,
      isStale: true,
      setupMessage: null,
    };
  }

  return {
    state: "ready",
    citySlug: options.citySlug,
    symbol: String(currentRate.symbol ?? citycoinRow.symbol ?? options.citySlug).toUpperCase(),
    exchangeRate: Number(currentRate.rate),
    baseCurrency: "CAD",
    source: typeof currentRate.source === "string" ? currentRate.source : null,
    observedAt: typeof currentRate.observed_at === "string" ? currentRate.observed_at : null,
    isStale: Boolean(currentRate.is_stale),
    setupMessage: null,
  };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return jsonResponse(req, { error: "Not found." }, { status: 404 });
    }

    const auth = await resolveAuthenticatedUser(req);
    const url = new URL(req.url);
    const rawPathname = url.pathname;
    const pathname =
      rawPathname.replace(/^\/functions\/v1\/citycoin-market/, "").replace(/^\/citycoin-market/, "") || "/";

    if (pathname !== "/rate/current") {
      return jsonResponse(req, { error: "Not found." }, { status: 404 });
    }

    const queryCitySlug = url.searchParams.get("citySlug")?.trim().toLowerCase() ?? null;
    const appContextInput = resolveAppContextInput(req, null);
    const explicitHeaderCitySlug = req.headers.get("x-city-slug")?.trim().toLowerCase() ?? null;

    if (
      queryCitySlug &&
      explicitHeaderCitySlug &&
      explicitHeaderCitySlug !== queryCitySlug
    ) {
      return jsonResponse(
        req,
        { error: `citySlug '${queryCitySlug}' does not match appContext city '${explicitHeaderCitySlug}'.` },
        { status: 400 }
      );
    }

    let citySlug = queryCitySlug;
    if (!citySlug) {
      const appContext = await resolveActiveAppContext({
        supabase: auth.serviceRole,
        input: appContextInput,
      });
      citySlug = appContext.citySlug;
      const result = await resolveCityRate({
        supabase: auth.serviceRole,
        citySlug,
      });
      return jsonResponse(req, result, { status: 200 });
    }

    const result = await resolveCityRate({
      supabase: auth.serviceRole,
      citySlug,
    });
    return jsonResponse(req, result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected citycoin-market error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("was not found")
          ? 404
          : 400;
    return jsonResponse(req, { error: message }, { status });
  }
}

DenoRuntime?.serve(handleRequest);
