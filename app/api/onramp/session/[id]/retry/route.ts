import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";
import { runSessionSettlement } from "@services/onramp/src";

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json().catch(() => ({}))) as { citySlug?: string };

    const citySlug = resolveCitySlug(body.citySlug);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    await assertAdminOrOperator({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const sessionId = context.params.id;
    if (!sessionId || sessionId.trim() === "") {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const result = await runSessionSettlement({
      supabase: serviceRole,
      sessionId,
      mode: "manual_operator",
      trigger: "admin",
      actorUserId: Number(userRow.id),
    });

    return NextResponse.json({
      sessionId,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp retry error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
