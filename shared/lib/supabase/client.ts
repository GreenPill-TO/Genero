import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoredCookie = { name: string; value: string; options?: Record<string, unknown> };

type CookieStore = {
  getAll?: () => StoredCookie[];
  set?: (name: string, value: string, options?: Record<string, unknown>) => void;
  setAll?: (cookiesToSet: StoredCookie[]) => void;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: SupabaseClient<any, any, any> | null = null;

export function createClient(): SupabaseClient<any, any, any> {
  if (typeof window === "undefined") {
    let cookieStore: CookieStore | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { cookies } = require("next/headers");
      if (typeof cookies === "function") {
        cookieStore = cookies();
      }
    } catch (error) {
      // The cookies helper is only available during request handling.
      // For build-time evaluation or other server contexts we can safely
      // proceed with a no-op cookie store.
      cookieStore = null;
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore?.getAll?.() ?? [];
        },
        setAll(cookiesToSet) {
          if (!cookieStore) {
            return;
          }

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore?.set?.(name, value, options);
            });
          } catch {
            // During build-time the setter can throw because response headers
            // are immutable. We can ignore these cases safely.
          }
        },
      },
    });
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
