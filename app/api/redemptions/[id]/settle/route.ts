import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const requestId = String(params.id ?? "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Request id is required." }, { status: 400 });
    }

    const body = (await req.json()) as {
      citySlug?: string;
      txHash?: string;
      settlementAmount?: number | string;
      settlementAsset?: string;
      notes?: string;
      failed?: boolean;
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
      .select("*")
      .eq("id", requestId)
      .limit(1)
      .maybeSingle();

    if (currentError) {
      throw new Error(`Failed to load redemption request: ${currentError.message}`);
    }

    if (!current) {
      return NextResponse.json({ error: "Redemption request not found." }, { status: 404 });
    }

    if (!body.failed && current.status !== "approved") {
      return NextResponse.json(
        { error: `Only approved requests can be settled (current status: ${current.status}).` },
        { status: 400 }
      );
    }

    if (body.failed && ["settled", "failed"].includes(current.status)) {
      return NextResponse.json(
        { error: `Request already finalized with status '${current.status}'.` },
        { status: 400 }
      );
    }

    const settlementAmount =
      body.settlementAmount == null
        ? toNumber(current.settlement_amount, Number.NaN)
        : toNumber(body.settlementAmount, Number.NaN);

    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return NextResponse.json(
        { error: "settlementAmount must be a positive number for settlement." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const settlementAsset = String(body.settlementAsset ?? current.settlement_asset ?? "CAD")
      .trim()
      .toUpperCase();
    const nextStatus = body.failed === true ? "failed" : "settled";

    const { data: updatedRequest, error: updateError } = await serviceRole
      .from("pool_redemption_requests")
      .update({
        status: nextStatus,
        settlement_amount: settlementAmount,
        settlement_asset: settlementAsset,
        settled_by: userRow.id,
        settled_at: nowIso,
        tx_hash: body.txHash ?? null,
        updated_at: nowIso,
      })
      .eq("id", requestId)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Failed to update redemption request for settlement: ${updateError.message}`);
    }

    const { data: settlementRow, error: settlementError } = await serviceRole
      .from("pool_redemption_settlements")
      .insert({
        redemption_request_id: requestId,
        settled_by: userRow.id,
        chain_id: current.chain_id,
        tx_hash: body.txHash ?? null,
        settlement_amount: settlementAmount,
        settlement_asset: settlementAsset,
        status: body.failed === true ? "failed" : "confirmed",
        notes: body.notes ?? null,
        metadata: {
          appInstanceId,
          citySlug,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (settlementError) {
      throw new Error(`Failed to create settlement record: ${settlementError.message}`);
    }

    await serviceRole.from("governance_actions_log").insert({
      action_type: body.failed === true ? "redemption_settlement_failed" : "redemption_settled",
      city_slug: citySlug,
      bia_id: current.bia_id,
      store_id: current.store_id,
      actor_user_id: userRow.id,
      reason:
        body.reason ??
        (body.failed === true
          ? "Redemption settlement execution failed"
          : "Redemption settlement executed"),
      payload: {
        appInstanceId,
        requestId,
        txHash: body.txHash ?? null,
        settlementAmount,
        settlementAsset,
        status: nextStatus,
      },
    });

    return NextResponse.json({
      request: updatedRequest,
      settlement: settlementRow,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error settling redemption";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
