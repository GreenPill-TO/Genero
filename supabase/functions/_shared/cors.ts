const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

function readAllowedOriginsFromEnv(): string[] {
  const configured = [
    Deno.env.get("USER_SETTINGS_ALLOWED_ORIGINS"),
    Deno.env.get("NEXT_PUBLIC_SITE_URL"),
    Deno.env.get("SITE_URL"),
    Deno.env.get("ONRAMP_APP_BASE_URL"),
  ];

  return configured
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(req?: Request): string | null {
  const requestOrigin = req?.headers.get("origin")?.trim() ?? "";
  if (!requestOrigin) {
    return null;
  }

  const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...readAllowedOriginsFromEnv()]);
  return allowedOrigins.has(requestOrigin) ? requestOrigin : null;
}

export function resolveCorsHeaders(req?: Request): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(req);

  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-slug, x-city-slug, x-app-environment",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  };
}
