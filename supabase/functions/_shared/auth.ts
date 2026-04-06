import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

type DenoEnv = {
  get(name: string): string | undefined;
};

type DenoLike = {
  env: DenoEnv;
};

const DenoRuntime = (globalThis as typeof globalThis & { Deno?: DenoLike }).Deno;

function requireEnv(name: string): string {
  const value = DenoRuntime?.env.get(name);
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function requireFirstEnv(names: string[]): string {
  for (const name of names) {
    const value = DenoRuntime?.env.get(name);
    if (value) {
      return value;
    }
  }

  throw new Error(`${names.join(" or ")} is required.`);
}

export function createServiceRoleClient() {
  return createClient(requireFirstEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function resolveBearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new Error("Unauthorized");
  }

  return token;
}

function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalised = value.trim().toLowerCase();
  return normalised.length > 0 ? normalised : null;
}

function isMissingTableError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return message.includes("does not exist") || message.includes("Could not find the table") || message.includes("schema cache");
}

export async function resolveAuthenticatedUser(req: Request) {
  const serviceRole = createServiceRoleClient();
  const token = resolveBearerToken(req);

  const {
    data: { user: authUser },
    error: authError,
  } = await serviceRole.auth.getUser(token);

  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  const { data: authUserRow, error: authRowError } = await serviceRole
    .from("users")
    .select("id,email,auth_user_id,cubid_id")
    .eq("auth_user_id", authUser.id)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (authRowError) {
    throw new Error(`Failed to resolve user row: ${authRowError.message}`);
  }

  let userRow = authUserRow;
  const authEmail = normaliseEmail(authUser.email);

  if (!userRow && authEmail) {
    const { data: emailHistoryRow, error: emailHistoryError } = await serviceRole
      .from("user_email_addresses")
      .select("user_id")
      .eq("email", authEmail)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (emailHistoryError && !isMissingTableError(emailHistoryError.message)) {
      throw new Error(`Failed to resolve user row by email history: ${emailHistoryError.message}`);
    }

    const historyUserId =
      typeof emailHistoryRow?.user_id === "number"
        ? emailHistoryRow.user_id
        : typeof emailHistoryRow?.user_id === "string"
          ? Number.parseInt(emailHistoryRow.user_id, 10)
          : null;

    if (historyUserId != null && Number.isFinite(historyUserId)) {
      const { data: emailHistoryUserRow, error: historyUserRowError } = await serviceRole
        .from("users")
        .select("id,email,auth_user_id,cubid_id")
        .eq("id", historyUserId)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (historyUserRowError) {
        throw new Error(`Failed to resolve user row from email history: ${historyUserRowError.message}`);
      }

      userRow = emailHistoryUserRow;
    }
  }

  if (!userRow && authEmail) {
    const { data: emailUserRow, error: emailRowError } = await serviceRole
      .from("users")
      .select("id,email,auth_user_id,cubid_id")
      .eq("email", authEmail)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (emailRowError) {
      throw new Error(`Failed to resolve user row by email: ${emailRowError.message}`);
    }

    userRow = emailUserRow;
  }

  if (!userRow) {
    throw new Error("Unauthorized");
  }

  return {
    serviceRole,
    authUser,
    userRow,
  };
}
