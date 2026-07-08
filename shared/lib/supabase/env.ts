export function resolveSupabasePublishableKey(): string {
  const canonical = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (canonical) {
    return canonical;
  }

  throw new Error(
    "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}
