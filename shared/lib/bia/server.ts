import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CITY_SLUG = (process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
const DEFAULT_APP_SLUG = (process.env.NEXT_PUBLIC_APP_NAME ?? "wallet").trim().toLowerCase();
const DEFAULT_APP_ENVIRONMENT = (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase();

export function resolveCitySlug(citySlug?: string): string {
  const value = (citySlug ?? DEFAULT_CITY_SLUG).trim().toLowerCase();
  if (!value) {
    throw new Error("City slug is required.");
  }
  return value;
}

export function resolveAppSlug(appSlug?: string): string {
  const value = (appSlug ?? DEFAULT_APP_SLUG).trim().toLowerCase();
  if (!value) {
    throw new Error("App slug is required.");
  }
  return value;
}

export async function resolveUserRow(options: {
  supabase: SupabaseClient<any, any, any>;
  authUserId: string;
  email?: string | null;
}) {
  const { supabase, authUserId, email } = options;

  let byAuthUserId = supabase
    .from("users")
    .select("id,email,auth_user_id,is_admin")
    .eq("auth_user_id", authUserId)
    .limit(1);

  const { data: authRows, error: authError } = await byAuthUserId;
  if (authError) {
    throw new Error(`Failed to resolve user by auth_user_id: ${authError.message}`);
  }

  if (Array.isArray(authRows) && authRows.length > 0) {
    return authRows[0];
  }

  if (!email) {
    throw new Error("Unable to resolve user row for current auth session.");
  }

  const { data: emailRows, error: emailError } = await supabase
    .from("users")
    .select("id,email,auth_user_id,is_admin")
    .eq("email", email)
    .limit(1);

  if (emailError) {
    throw new Error(`Failed to resolve user by email: ${emailError.message}`);
  }

  if (!Array.isArray(emailRows) || emailRows.length === 0) {
    throw new Error("Unable to resolve user row for current auth session.");
  }

  return emailRows[0];
}

export async function resolveActiveAppInstanceId(options: {
  supabase: SupabaseClient<any, any, any>;
  citySlug?: string;
  appSlug?: string;
  environment?: string | null;
}) {
  const citySlug = resolveCitySlug(options.citySlug);
  const appSlug = resolveAppSlug(options.appSlug);
  const environment = (options.environment ?? DEFAULT_APP_ENVIRONMENT).trim().toLowerCase();

  let query = options.supabase
    .from("ref_app_instances")
    .select("id, slug, environment, ref_apps!inner(slug), ref_citycoins!inner(slug)")
    .eq("ref_apps.slug", appSlug)
    .eq("ref_citycoins.slug", citySlug);

  if (environment) {
    query = query.eq("environment", environment);
  } else {
    query = query.order("environment", { ascending: true });
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve active app instance: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`No app instance found for app='${appSlug}' city='${citySlug}'.`);
  }

  return Number(data.id);
}

export async function userHasAnyRole(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  roles: string[];
  appInstanceId?: number;
}): Promise<boolean> {
  if (options.roles.length === 0) {
    return false;
  }

  const roleValues = options.roles.map((role) => role.trim().toLowerCase()).filter(Boolean);
  if (roleValues.length === 0) {
    return false;
  }

  let query = options.supabase
    .from("roles")
    .select("role")
    .eq("user_id", options.userId)
    .in("role", roleValues);

  if (typeof options.appInstanceId === "number" && Number.isFinite(options.appInstanceId) && options.appInstanceId > 0) {
    query = query.eq("app_instance_id", options.appInstanceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to resolve user roles: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

export async function assertAdminOrOperator(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId?: number;
}) {
  const hasRole = await userHasAnyRole({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    roles: ["admin", "operator"],
  });

  if (!hasRole) {
    throw new Error("Forbidden: admin/operator role required.");
  }
}

export async function assertStoreAccess(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  storeId: number;
  appInstanceId?: number;
}) {
  const hasScopedAppInstance = typeof options.appInstanceId === "number" && Number.isFinite(options.appInstanceId) && options.appInstanceId > 0;

  let storeAccessQuery = options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("store_id", options.storeId)
    .eq("user_id", options.userId)
    .limit(1);

  if (hasScopedAppInstance) {
    storeAccessQuery = storeAccessQuery.eq("app_instance_id", options.appInstanceId as number);
  }

  const [isAdminOrOperator, storeEmployeeResult] = await Promise.all([
    userHasAnyRole({
      supabase: options.supabase,
      userId: options.userId,
      appInstanceId: hasScopedAppInstance ? (options.appInstanceId as number) : undefined,
      roles: ["admin", "operator"],
    }),
    storeAccessQuery,
  ]);

  if (isAdminOrOperator) {
    return;
  }

  if (storeEmployeeResult.error) {
    throw new Error(`Failed to validate store access: ${storeEmployeeResult.error.message}`);
  }

  const storeRows = storeEmployeeResult.data;
  if (!Array.isArray(storeRows) || storeRows.length === 0) {
    throw new Error("Forbidden: store access required.");
  }
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6371 * c;
}
