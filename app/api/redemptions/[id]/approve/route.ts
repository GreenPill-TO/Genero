import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const requestId = String(params.id ?? "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Request id is required." }, { status: 400 });
    }

    const body = (await req.json()) as {
      citySlug?: string;
      approve?: boolean;
      rejectionReason?: string;
      reason?: string;
    };

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

    const { data: current, error: currentError } = await serviceRole
      .from("pool_redemption_requests")
      .select("id,status,bia_id,store_id,chain_id,pool_address")
      .eq("id", requestId)
      .limit(1)
      .maybeSingle();

    if (currentError) {
      throw new Error(`Failed to load redemption request: ${currentError.message}`);
    }

    if (!current) {
      return NextResponse.json({ error: "Redemption request not found." }, { status: 404 });
    }

    if (["settled", "failed", "rejected"].includes(String(current.status))) {
      return NextResponse.json(
        { error: `Cannot approve request in '${current.status}' state.` },
        { status: 400 }
      );
    }

    const approve = body.approve !== false;
    const nextStatus = approve ? "approved" : "rejected";
    const nowIso = new Date().toISOString();

    const { data: updated, error: updateError } = await serviceRole
      .from("pool_redemption_requests")
      .update({
        status: nextStatus,
        approved_by: approve ? userRow.id : null,
        approved_at: approve ? nowIso : null,
        rejection_reason: approve ? null : body.rejectionReason ?? "Rejected by operator",
        updated_at: nowIso,
      })
      .eq("id", requestId)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Failed to update redemption request status: ${updateError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: approve ? "redemption_approved" : "redemption_rejected",
      city_slug: citySlug,
      bia_id: current.bia_id,
      store_id: current.store_id,
      actor_user_id: userRow.id,
      reason: body.reason ?? (approve ? "Redemption request approved" : "Redemption request rejected"),
      payload: {
        appInstanceId,
        requestId,
        status: nextStatus,
        rejectionReason: approve ? null : body.rejectionReason ?? null,
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error approving redemption";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
