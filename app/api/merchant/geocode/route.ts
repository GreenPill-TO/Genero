import { NextResponse } from "next/server";
import { resolveMerchantSignupContext } from "@shared/lib/merchantSignup/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      citySlug?: string;
      countryCode?: string;
    };

    const address = (body.address ?? "").trim();
    if (!address) {
      return NextResponse.json({ error: "address is required." }, { status: 400 });
    }

    const { citySlug } = await resolveMerchantSignupContext(body.citySlug);

    const countryCode = (body.countryCode ?? "ca").trim().toLowerCase();
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      countrycodes: countryCode,
      q: address,
    });

    const userAgent = process.env.NOMINATIM_USER_AGENT ?? "Genero Merchant Signup Geocoder";

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        "user-agent": userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding provider returned status ${response.status}.`);
    }

    const payload = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      place_id?: number;
    }>;

    const first = Array.isArray(payload) ? payload[0] : undefined;
    const lat = first?.lat ? Number.parseFloat(first.lat) : Number.NaN;
    const lng = first?.lon ? Number.parseFloat(first.lon) : Number.NaN;

    if (!first || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Unable to geocode the provided address." }, { status: 404 });
    }

    return NextResponse.json({
      citySlug,
      query: address,
      normalizedAddress: typeof first.display_name === "string" ? first.display_name : address,
      lat,
      lng,
      provider: "nominatim",
      placeId: typeof first.place_id === "number" ? first.place_id : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected geocoding error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
