import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@shared/lib/bia/apiAuth";
import { resolveActiveAppInstanceId, resolveCitySlug, toNumber } from "@shared/lib/bia/server";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { listMerchantsForVoucherScope, resolveActiveUserBiaSet } from "@shared/lib/vouchers/routing";

export async function GET(req: Request) {
  try {
    const { serviceRole, userRow } = await resolveApiAuthContext();
    const url = new URL(req.url);

    const citySlug = resolveCitySlug(url.searchParams.get("citySlug") ?? undefined);
    const requestedChainId = toNumber(url.searchParams.get("chainId"), 0);
    const scopeRaw = (url.searchParams.get("scope") ?? "my_pool").trim().toLowerCase();
    const scope = scopeRaw === "city" ? "city" : "my_pool";

    const activeContracts = await getActiveCityContracts({ citySlug, forceRefresh: true });
    const chainId = requestedChainId > 0 ? Math.trunc(requestedChainId) : activeContracts.chainId;

    const appInstanceId = await resolveActiveAppInstanceId({ supabase: serviceRole, citySlug });

    const [merchants, userBiaScope] = await Promise.all([
      listMerchantsForVoucherScope({
        supabase: serviceRole,
        citySlug,
        chainId,
        userId: Number(userRow.id),
        appInstanceId,
        scope,
      }),
      resolveActiveUserBiaSet({
        supabase: serviceRole,
        userId: Number(userRow.id),
        appInstanceId,
      }),
    ]);

    return NextResponse.json({
      citySlug,
      chainId,
      scope,
      liquiditySource: "sarafu_onchain",
      readOnly: true,
      appInstanceId,
      biaScope: {
        primaryBiaId: userBiaScope.primaryBiaId,
        secondaryBiaIds: userBiaScope.secondaryBiaIds,
      },
      merchants,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected voucher merchants error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
