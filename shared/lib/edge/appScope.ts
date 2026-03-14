export type AppScopeInput = {
  appSlug?: string | null;
  citySlug?: string | null;
  environment?: string | null;
};

export type ResolvedAppScope = {
  appSlug: string;
  citySlug: string;
  environment: string;
};

const DEFAULT_APP_SLUG = (process.env.NEXT_PUBLIC_APP_NAME ?? "wallet").trim().toLowerCase();
const DEFAULT_CITY_SLUG = (process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
const DEFAULT_ENVIRONMENT = (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase();

export function resolveAppScope(overrides?: AppScopeInput | null): ResolvedAppScope {
  const appSlug = (overrides?.appSlug ?? DEFAULT_APP_SLUG).trim().toLowerCase();
  const citySlug = (overrides?.citySlug ?? DEFAULT_CITY_SLUG).trim().toLowerCase();
  const environment = (overrides?.environment ?? DEFAULT_ENVIRONMENT).trim().toLowerCase();

  if (!appSlug) {
    throw new Error("App slug is required.");
  }

  if (!citySlug) {
    throw new Error("City slug is required.");
  }

  return {
    appSlug,
    citySlug,
    environment,
  };
}
