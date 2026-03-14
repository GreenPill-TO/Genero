import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, userHasAnyRole } from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const { searchParams } = new URL(req.url);

    const citySlug = resolveCitySlug(searchParams.get("citySlug") ?? undefined);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const isAdminOrOperator = await userHasAnyRole({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      roles: ["admin", "operator"],
    });

    return NextResponse.json({
      citySlug,
      appInstanceId,
      isAdminOrOperator,
      canAccessAdminDashboard: isAdminOrOperator,
      canAccessCityManager: isAdminOrOperator,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error resolving control-plane access";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
