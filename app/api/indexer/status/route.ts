import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { getIndexerScopeStatus } from "@services/indexer/src";

export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const citySlug = searchParams.get("citySlug") ?? undefined;

    const status = await getIndexerScopeStatus({
      supabase,
      citySlug,
    });

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected indexer status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
