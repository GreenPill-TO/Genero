import { createClient } from "@shared/lib/supabase/server";
import { createServiceRoleClient } from "@shared/lib/supabase/serviceRole";
import { resolveUserRow } from "@shared/lib/bia/server";

export function isLocalOrDevelopmentEnvironment(): boolean {
  const environment = (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase();
  return environment === "local" || environment === "development";
}

async function resolveBypassUserRow(serviceRole: ReturnType<typeof createServiceRoleClient>) {
  const configuredUserId = Number.parseInt(process.env.AUTH_BYPASS_USER_ID ?? "", 10);

  if (!Number.isFinite(configuredUserId) || configuredUserId <= 0) {
    throw new Error("AUTH_BYPASS_USER_ID must be set to a positive public.users.id in local or development.");
  }

  const { data: configuredRow, error: configuredError } = await serviceRole
    .from("users")
    .select("id,email,auth_user_id,is_admin")
    .eq("id", configuredUserId)
    .limit(1)
    .maybeSingle();

  if (configuredError) {
    throw new Error(`Failed to resolve AUTH_BYPASS_USER_ID=${configuredUserId}: ${configuredError.message}`);
  }

  if (!configuredRow) {
    throw new Error(`AUTH_BYPASS_USER_ID=${configuredUserId} did not match any public.users row.`);
  }

  return configuredRow;
}

export async function resolveApiAuthContext() {
  const serverClient = createClient();
  const {
    data: { user },
    error: userError,
  } = await serverClient.auth.getUser();

  const serviceRole = createServiceRoleClient();

  if (userError || !user) {
    if (!isLocalOrDevelopmentEnvironment()) {
      throw new Error("Unauthorized");
    }

    const bypassUserRow = await resolveBypassUserRow(serviceRole);
    const bypassAuthUserId =
      (typeof bypassUserRow.auth_user_id === "string" && bypassUserRow.auth_user_id.trim() !== ""
        ? bypassUserRow.auth_user_id
        : `dev-bypass-${bypassUserRow.id}`) ?? `dev-bypass-${bypassUserRow.id}`;

    return {
      authUser: {
        id: bypassAuthUserId,
        email: typeof bypassUserRow.email === "string" ? bypassUserRow.email : null,
      },
      userRow: bypassUserRow,
      serviceRole,
      authBypassed: true,
    };
  }

  const userRow = await resolveUserRow({
    supabase: serviceRole,
    authUserId: user.id,
    email: user.email,
  });

  return {
    authUser: user,
    userRow,
    serviceRole,
    authBypassed: false,
  };
}
