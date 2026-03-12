import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug } from "@shared/lib/bia/server";
import { isBuyTcoinCheckoutEnabled } from "@shared/lib/onramp/feature";
import { runUserOnrampTouch } from "@services/onramp/src";

export async function POST(req: Request) {
  try {
    if (!isBuyTcoinCheckoutEnabled()) {
      return NextResponse.json({
        scanned: 0,
        settled: 0,
        manualReview: 0,
        skipped: 0,
        disabled: true,
      });
    }

    const { serviceRole, userRow } = await resolveApiAuthContext();
    const body = (await req.json().catch(() => ({}))) as { citySlug?: string };
    const citySlug = resolveCitySlug(body.citySlug);

    const appInstanceId = await resolveActiveAppInstanceId({
      supabase: serviceRole,
      citySlug,
    });

    const result = await runUserOnrampTouch({
      supabase: serviceRole,
      userId: Number(userRow.id),
      appInstanceId,
      citySlug,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected onramp touch error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
