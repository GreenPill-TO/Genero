type ResolveAppContextInput = {
  appSlug?: string | null;
  citySlug?: string | null;
  environment?: string | null;
};

export type EdgeAppContext = {
  appSlug: string;
  citySlug: string;
  environment: string;
  appInstanceId: number;
};

export function resolveAppContextInput(req: Request, body?: Record<string, unknown> | null): ResolveAppContextInput {
  const nested = body?.appContext && typeof body.appContext === "object" ? (body.appContext as Record<string, unknown>) : null;

  return {
    appSlug:
      (typeof nested?.appSlug === "string" ? nested.appSlug : null) ??
      req.headers.get("x-app-slug") ??
      "wallet",
    citySlug:
      (typeof nested?.citySlug === "string" ? nested.citySlug : null) ??
      req.headers.get("x-city-slug") ??
      "tcoin",
    environment:
      (typeof nested?.environment === "string" ? nested.environment : null) ??
      req.headers.get("x-app-environment") ??
      "",
  };
}

export async function resolveActiveAppContext(options: {
  supabase: any;
  input: ResolveAppContextInput;
}): Promise<EdgeAppContext> {
  const appSlug = (options.input.appSlug ?? "wallet").trim().toLowerCase();
  const citySlug = (options.input.citySlug ?? "tcoin").trim().toLowerCase();
  const environment = (options.input.environment ?? "").trim().toLowerCase();

  let query = options.supabase
    .from("ref_app_instances")
    .select("id,environment,ref_apps!inner(slug),ref_citycoins!inner(slug)")
    .eq("ref_apps.slug", appSlug)
    .eq("ref_citycoins.slug", citySlug);

  if (environment) {
    query = query.eq("environment", environment);
  } else {
    query = query.order("environment", { ascending: true });
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve app instance: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`No app instance found for app='${appSlug}' city='${citySlug}'.`);
  }

  return {
    appSlug,
    citySlug,
    environment,
    appInstanceId: Number(data.id),
  };
}
