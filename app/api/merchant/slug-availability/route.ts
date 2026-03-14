import { NextResponse } from "next/server";
import { resolveMerchantSignupContext, assertValidStoreSlug, normaliseStoreSlug } from "@shared/lib/merchantSignup/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawSlug = url.searchParams.get("slug") ?? "";
    const excludeStoreId = Number(url.searchParams.get("excludeStoreId") ?? 0);

    const slug = assertValidStoreSlug(rawSlug);
    const { serviceRole, citySlug, appInstanceId } = await resolveMerchantSignupContext(
      url.searchParams.get("citySlug") ?? undefined
    );

    let query = serviceRole
      .from("store_profiles")
      .select("store_id,slug")
      .eq("app_instance_id", appInstanceId)
      .ilike("slug", normaliseStoreSlug(slug))
      .limit(5);

    if (Number.isFinite(excludeStoreId) && excludeStoreId > 0) {
      query = query.neq("store_id", excludeStoreId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to check slug availability: ${error.message}`);
    }

    const available = !Array.isArray(data) || data.length === 0;

    return NextResponse.json({
      citySlug,
      appInstanceId,
      slug,
      available,
      reason: available ? null : "Slug is already taken in this city app scope.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error checking slug availability";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("Store slug must")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
