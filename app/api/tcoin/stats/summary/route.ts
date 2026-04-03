import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { getWalletStatsSummary } from "@shared/lib/walletStats/server";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getWalletStatsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected wallet stats error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
