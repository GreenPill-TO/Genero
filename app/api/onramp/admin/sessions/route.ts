import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const { searchParams } = new URL(req.url);

    const citySlug = resolveCitySlug(searchParams.get("citySlug") ?? undefined);
    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    await assertAdminOrOperator({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
    });

    const limit = Math.max(1, Math.min(200, Math.trunc(toNumber(searchParams.get("limit"), 50))));
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() ?? null;
    const userId = Math.trunc(toNumber(searchParams.get("userId"), 0));

    let query = serviceRole
      .from("v_onramp_checkout_admin")
      .select("*")
      .eq("city_slug", citySlug)
      .eq("app_instance_id", appInstanceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (Number.isFinite(userId) && userId > 0) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load onramp admin sessions: ${error.message}`);
    }

    const sessions = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      userId: Number(row.user_id),
      provider: String(row.provider ?? "transak"),
      fiatAmount: String(row.fiat_amount ?? "0"),
      fiatCurrency: String(row.fiat_currency ?? "CAD"),
      status: String(row.status ?? "created"),
      statusReason: typeof row.status_reason === "string" ? row.status_reason : null,
      depositAddress: String(row.deposit_address ?? ""),
      recipientWallet: String(row.recipient_wallet ?? ""),
      incomingUsdcTxHash: typeof row.incoming_usdc_tx_hash === "string" ? row.incoming_usdc_tx_hash : null,
      mintTxHash: typeof row.mint_tx_hash === "string" ? row.mint_tx_hash : null,
      tcoinOutAmount: typeof row.tcoin_out_amount === "string" || typeof row.tcoin_out_amount === "number"
        ? String(row.tcoin_out_amount)
        : null,
      latestAttemptNo: typeof row.latest_attempt_no === "number" ? row.latest_attempt_no : null,
      latestAttemptMode: typeof row.latest_attempt_mode === "string" ? row.latest_attempt_mode : null,
      latestAttemptState: typeof row.latest_attempt_state === "string" ? row.latest_attempt_state : null,
      latestAttemptError: typeof row.latest_attempt_error === "string" ? row.latest_attempt_error : null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    }));

    return NextResponse.json({
      citySlug,
      appInstanceId,
      sessions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp admin list error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
