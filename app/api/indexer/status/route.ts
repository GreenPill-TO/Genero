import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { getIndexerScopeStatusReadModel } from "@shared/lib/indexer/statusReadModel";
import { isTorontoCoinMainnetRuntimeAdmitted } from "@shared/lib/contracts/torontocoinRuntime";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const citySlug = searchParams.get("citySlug") ?? undefined;
    const effectiveCitySlug = (citySlug ?? process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
    if (effectiveCitySlug === "tcoin" && !isTorontoCoinMainnetRuntimeAdmitted()) {
      return NextResponse.json(
        { error: "Indexer status requires the explicit Production celo-mainnet profile." },
        { status: 409 }
      );
    }
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopmentEnvironment()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
