import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { getTorontoCoinOpsStatus } from "@shared/lib/contracts/torontocoinOps";
import { getIndexerScopeStatusReadModel } from "@shared/lib/indexer/statusReadModel";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopmentEnvironment()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getTorontoCoinOpsStatus();
    const indexerStatus = await getIndexerScopeStatusReadModel({
      supabase,
      citySlug: "tcoin",
      chainId: status.addresses.chainId,
      requiredTokenAddress: status.addresses.cplTcoin,
    });

    return NextResponse.json({
      ...status,
      indexer: indexerStatus.torontoCoinTracking ?? {
        requiredTokenAddress: status.addresses.cplTcoin,
        cplTcoinTracked: false,
        trackedPools: [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected TorontoCoin ops status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
