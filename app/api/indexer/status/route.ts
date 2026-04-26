import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { getIndexerScopeStatusReadModel } from "@shared/lib/indexer/statusReadModel";

export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopmentEnvironment()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const citySlug = searchParams.get("citySlug") ?? undefined;

    const status = await getIndexerScopeStatusReadModel({
      supabase,
      citySlug,
    });

    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected indexer status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
