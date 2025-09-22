import { createClient } from "@shared/lib/supabase/client";

export interface AppInstanceRecord {
  id: number;
  slug: string;
  environment: string | null;
}

let cachedAppInstance: AppInstanceRecord | null = null;
let hasResolved = false;
let pendingResolution: Promise<AppInstanceRecord | null> | null = null;

const normaliseWithFallback = (value: string | undefined | null, fallback: string) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
};

const normaliseOptional = (value: string | undefined | null) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

const toNumericId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const mapRowToInstance = (row: any): AppInstanceRecord | null => {
  if (!row) {
    return null;
  }
  const id = toNumericId(row.id);
  const slug = typeof row.slug === "string" && row.slug.trim().length > 0 ? row.slug.trim() : null;
  const environment = typeof row.environment === "string" && row.environment.trim().length > 0 ? row.environment.trim() : null;

  if (id === null || !slug) {
    return null;
  }

  return { id, slug, environment };
};

const resolveActiveInstance = async (): Promise<AppInstanceRecord | null> => {
  if (hasResolved) {
    return cachedAppInstance;
  }
  if (pendingResolution) {
    return pendingResolution;
  }

  pendingResolution = (async () => {
    const supabase = createClient();
    const appSlug = normaliseWithFallback(process.env.NEXT_PUBLIC_APP_NAME, "wallet");
    const citySlug = normaliseWithFallback(process.env.NEXT_PUBLIC_CITYCOIN, "tcoin");
    const environment = normaliseOptional(
      process.env.NEXT_PUBLIC_APP_ENVIRONMENT ??
        process.env.NEXT_PUBLIC_DEPLOY_ENV ??
        process.env.NEXT_PUBLIC_ENV
    );

    let query = supabase
      .from("app_instances")
      .select("id, slug, environment, apps!inner(slug), citycoins!inner(slug)");

    query = query.eq("apps.slug", appSlug).eq("citycoins.slug", citySlug);

    if (environment) {
      query = query.eq("environment", environment);
    } else {
      query = query.order("environment", { ascending: true });
    }

    query = query.limit(1);

    const { data, error } = await query.maybeSingle();

    if (error) {
      pendingResolution = null;
      throw error;
    }

    cachedAppInstance = mapRowToInstance(data);
    hasResolved = true;
    pendingResolution = null;

    return cachedAppInstance;
  })();

  return pendingResolution;
};

export const getActiveAppInstance = async (): Promise<AppInstanceRecord | null> => {
  return resolveActiveInstance();
};

export const getActiveAppInstanceId = async (): Promise<number | null> => {
  const instance = await resolveActiveInstance();
  return instance?.id ?? null;
};

export const clearCachedAppInstance = () => {
  cachedAppInstance = null;
  hasResolved = false;
  pendingResolution = null;
};
