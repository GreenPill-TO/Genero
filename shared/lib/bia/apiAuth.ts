import { createClient } from "@shared/lib/supabase/server";
import { createServiceRoleClient } from "@shared/lib/supabase/serviceRole";
import { resolveUserRow } from "@shared/lib/bia/server";

export async function resolveApiAuthContext() {
  const serverClient = createClient();
  const {
    data: { user },
    error: userError,
  } = await serverClient.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const serviceRole = createServiceRoleClient();
  const userRow = await resolveUserRow({
    supabase: serviceRole,
    authUserId: user.id,
    email: user.email,
  });

  return {
    authUser: user,
    userRow,
    serviceRole,
  };
}
