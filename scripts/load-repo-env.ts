import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let didLoad = false;

export function loadRepoEnv() {
  if (didLoad) {
    return;
  }

  loadEnvConfig(process.cwd());
  didLoad = true;
}

export function getMissingEnv(names: string[]) {
  return names.filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim() === "";
  });
}

export function requireEnv(names: string[], context: string) {
  const missingEnv = getMissingEnv(names);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required env for ${context}: ${missingEnv.join(", ")}.`);
  }
}

export function createOpsSupabaseClient() {
  requireEnv(
    ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    "TorontoCoin ops and wallet release preflight"
  );

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function describeSupabaseAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Invalid schema: indexer")) {
    return `${message}. The target Supabase Data API is not exposing the indexer schema. Add both "indexer" and "chain_data" to the project's exposed schemas, then confirm the env is using the intended project.`;
  }

  if (message.includes("Invalid schema: chain_data")) {
    return `${message}. The target Supabase Data API is not exposing the chain_data schema. Add both "indexer" and "chain_data" to the project's exposed schemas, then confirm the env is using the intended project.`;
  }

  return message;
}
