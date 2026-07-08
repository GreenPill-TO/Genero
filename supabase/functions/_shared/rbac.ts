export async function userHasAnyRole(options: {
  supabase: any;
  userId: number;
  roles: string[];
  appInstanceId?: number;
}): Promise<boolean> {
  const roles = options.roles.map((role) => role.trim().toLowerCase()).filter(Boolean);
  if (roles.length === 0) {
    return false;
  }

  let query = options.supabase
    .from("roles")
    .select("role")
    .eq("user_id", options.userId)
    .in("role", roles);

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
  supabase: any;
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
  supabase: any;
  userId: number;
  storeId: number;
  appInstanceId?: number;
}) {
  const isPrivileged = await userHasAnyRole({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    roles: ["admin", "operator"],
  });

  if (isPrivileged) {
    return;
  }

  let query = options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("store_id", options.storeId)
    .eq("user_id", options.userId)
    .limit(1);

  if (typeof options.appInstanceId === "number" && Number.isFinite(options.appInstanceId) && options.appInstanceId > 0) {
    query = query.eq("app_instance_id", options.appInstanceId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to validate store access: ${error.message}`);
  }

  if (!data) {
    throw new Error("Forbidden: store access required.");
  }
}

export async function assertStoreAdminAccess(options: {
  supabase: any;
  userId: number;
  storeId: number;
  appInstanceId?: number;
}) {
  const isPrivileged = await userHasAnyRole({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appInstanceId,
    roles: ["admin", "operator"],
  });

  if (isPrivileged) {
    return;
  }

  let query = options.supabase
    .from("store_employees")
    .select("store_id")
    .eq("store_id", options.storeId)
    .eq("user_id", options.userId)
    .eq("is_admin", true)
    .limit(1);

  if (typeof options.appInstanceId === "number" && Number.isFinite(options.appInstanceId) && options.appInstanceId > 0) {
    query = query.eq("app_instance_id", options.appInstanceId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to validate store admin access: ${error.message}`);
  }

  if (!data) {
    throw new Error("Forbidden: store admin access required.");
  }
}
