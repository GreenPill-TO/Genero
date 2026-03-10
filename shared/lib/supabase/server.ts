import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type SupabaseCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function resolveSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return key;
}
const supabasePublishableDefaultKey = resolveSupabasePublishableKey();

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublishableDefaultKey,
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    }
  );
}
