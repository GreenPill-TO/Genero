import { useQuery } from "@tanstack/react-query";

export type ControlPlaneAccess = {
  citySlug: string;
  appInstanceId: number;
  isAdminOrOperator: boolean;
  canAccessAdminDashboard: boolean;
  canAccessCityManager: boolean;
};

async function fetchControlPlaneAccess(citySlug: string): Promise<ControlPlaneAccess> {
  const response = await fetch(`/api/control-plane/access?citySlug=${encodeURIComponent(citySlug)}`, {
    credentials: "include",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body as ControlPlaneAccess;
}

export function useControlPlaneAccess(citySlug = "tcoin", enabled = true) {
  return useQuery({
    queryKey: ["control-plane-access", citySlug],
    queryFn: () => fetchControlPlaneAccess(citySlug),
    enabled,
    staleTime: 60_000,
  });
}
