import { createClient } from "@supabase/supabase-js";

export function createServiceRoleClientCore(options?: { context?: string }) {
  const context = options?.context ?? "server-side privileged operations";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is required for ${context}.`);
  }

  if (!serviceRoleKey) {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY is required for ${context}.`);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
