import { invokeEdgeFunction } from "./core";
import type { AppScopeInput } from "./types";
import type { ControlPlaneAccess } from "./controlPlane";

export async function getControlPlaneAccess(appContext?: AppScopeInput | null): Promise<ControlPlaneAccess> {
  return invokeEdgeFunction<ControlPlaneAccess>("control-plane", "/access", {
    method: "GET",
    appContext,
  });
}
