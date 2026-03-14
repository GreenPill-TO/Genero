import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { haversineKm, resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { serviceRole } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const lat = toNumber(url.searchParams.get("lat"), Number.NaN);
    const lng = toNumber(url.searchParams.get("lng"), Number.NaN);
    const limit = Math.max(1, Math.min(20, Math.trunc(toNumber(url.searchParams.get("limit"), 5))));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "lat and lng query params are required numeric values." },
        { status: 400 }
      );
    }

    const { data, error } = await serviceRole
      .from("bia_registry")
      .select("id,city_slug,code,name,center_lat,center_lng,status,metadata")
      .eq("city_slug", citySlug)
      .eq("status", "active");

    if (error) {
      throw new Error(`Failed to load BIAs: ${error.message}`);
    }

    const suggestions = (data ?? [])
      .map((bia) => ({
        ...bia,
        distanceKm: haversineKm(lat, lng, Number(bia.center_lat), Number(bia.center_lng)),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return NextResponse.json({ citySlug, lat, lng, suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error suggesting BIAs";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
