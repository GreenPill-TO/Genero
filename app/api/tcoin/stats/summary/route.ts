import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { getWalletStatsSummary } from "@shared/lib/walletStats/server";

export async function GET() {
  try {
    if (process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET === "celo-sepolia-pay-link") {
      return NextResponse.json(
        { error: "Wallet stats are unavailable for the isolated Preview pay-link profile." },
        { status: 409 }
      );
    }
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This endpoint is intentionally available to any authenticated wallet user.
    // The stats page is a read-only product surface, and this payload is limited to
    // aggregate counts, trends, and coarse health flags rather than secrets or per-user data.
    const summary = await getWalletStatsSummary(supabase);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected wallet stats error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
