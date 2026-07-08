import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { GovernanceActionsResponse } from "./governance";

export async function getGovernanceActions(
  input?: {
    biaId?: string | null;
    storeId?: number | null;
    limit?: number | null;
    appContext?: AppScopeInput | null;
  }
): Promise<GovernanceActionsResponse> {
  const params = new URLSearchParams();
  if (input?.biaId) {
    params.set("biaId", input.biaId);
  }
  if (typeof input?.storeId === "number" && input.storeId > 0) {
    params.set("storeId", String(input.storeId));
  }
  if (typeof input?.limit === "number" && input.limit > 0) {
    params.set("limit", String(input.limit));
  }
  return invokeEdgeFunction<GovernanceActionsResponse>(
    "governance",
    `/actions${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      method: "GET",
      appContext: input?.appContext,
    }
  );
}
