import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/api/hooks/useAuth";
import { getControlPlaneAccess } from "@shared/lib/edge/controlPlaneClient";
import { resolveAppScope } from "@shared/lib/edge/appScope";

export type ControlPlaneAccess = {
  citySlug: string;
  appInstanceId: number;
  isAdminOrOperator: boolean;
  canAccessAdminDashboard: boolean;
  canAccessCityManager: boolean;
};

async function fetchControlPlaneAccess(citySlug: string): Promise<ControlPlaneAccess> {
  return getControlPlaneAccess(resolveAppScope({ citySlug }));
}

export function useControlPlaneAccess(citySlug = "tcoin", enabled = true) {
  const { authData } = useAuth();
  const authUserId = authData?.user?.id ?? "anonymous";

  return useQuery({
    queryKey: ["control-plane-access", citySlug, authUserId],
    queryFn: () => fetchControlPlaneAccess(citySlug),
    enabled,
    staleTime: 60_000,
  });
}
