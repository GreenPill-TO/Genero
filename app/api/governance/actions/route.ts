import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { serviceRole } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const biaId = url.searchParams.get("biaId");
    const storeId = toNumber(url.searchParams.get("storeId"), 0);
    const limit = Math.max(1, Math.min(200, Math.trunc(toNumber(url.searchParams.get("limit"), 100))));

    let query = serviceRole
      .from("governance_actions_log")
      .select("*")
      .eq("city_slug", citySlug)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (biaId) {
      query = query.eq("bia_id", biaId);
    }

    if (Number.isFinite(storeId) && storeId > 0) {
      query = query.eq("store_id", storeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load governance action feed: ${error.message}`);
    }

    return NextResponse.json({
      citySlug,
      actions: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error loading governance feed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
