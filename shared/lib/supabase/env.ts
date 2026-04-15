const LEGACY_PUBLISHABLE_KEY_NAMES = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function resolveSupabasePublishableKey(): string {
  const canonical = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (canonical) {
    return canonical;
  }

  for (const legacyName of LEGACY_PUBLISHABLE_KEY_NAMES) {
    const legacyValue = process.env[legacyName]?.trim();
    if (legacyValue) {
      return legacyValue;
    }
  }

  throw new Error(
    "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}
