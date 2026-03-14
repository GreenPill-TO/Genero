import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { assertAdminOrOperator, resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";

function buildLegacyRampSchemaError(error: { message?: string } | null, scope: string): string {
  const message = error?.message ?? `Failed to load ${scope}.`;
  const normalised = message.toLowerCase();

  if (normalised.includes("does not exist") || normalised.includes("could not find the table")) {
    return `Missing legacy ramp schema for ${scope}: ${message}`;
  }

  if (normalised.includes("could not find a relationship")) {
    return `Missing legacy ramp schema relationship for ${scope}: ${message}`;
  }

  return `Failed to load ${scope}: ${message}`;
}

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

    const [onRampResult, offRampResult, statusResult] = await Promise.all([
      serviceRole
        .from("interac_transfer")
        .select(
          "id, created_at, amount, amount_override, status, admin_notes, bank_reference, interac_code, is_sent, approved_timestamp, user_id, users(full_name, email)"
        )
        .eq("app_instance_id", appInstanceId)
        .order("created_at", { ascending: false }),
      serviceRole
        .from("off_ramp_req")
        .select(
          "id, created_at, updated_at, cad_to_user, tokens_burned, exchange_rate, cad_off_ramp_fee, admin_notes, bank_reference_number, status, interac_transfer_target, wallet_account, user_id, users(full_name, email)"
        )
        .eq("app_instance_id", appInstanceId)
        .order("created_at", { ascending: false }),
      serviceRole.from("ref_request_statuses").select("status").order("status", { ascending: true }),
    ]);

    if (onRampResult.error) {
      throw new Error(buildLegacyRampSchemaError(onRampResult.error, "legacy on-ramp requests"));
    }

    if (offRampResult.error) {
      throw new Error(buildLegacyRampSchemaError(offRampResult.error, "legacy off-ramp requests"));
    }

    if (statusResult.error) {
      throw new Error(buildLegacyRampSchemaError(statusResult.error, "legacy request statuses"));
    }

    return NextResponse.json({
      citySlug,
      appInstanceId,
      onRampRequests: onRampResult.data ?? [],
      offRampRequests: offRampResult.data ?? [],
      statuses: statusResult.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected legacy ramp request error";
    const status =
      message === "Unauthorized"
        ? 401
        : message.startsWith("Forbidden")
          ? 403
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
