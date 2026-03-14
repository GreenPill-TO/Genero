"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/api/hooks/useAuth";
import { getUserSettingsBootstrap } from "@shared/lib/userSettings/client";
import { resolveUserSettingsAppContext } from "@shared/lib/userSettings/context";
import type { UserSettingsAppContext } from "@shared/lib/userSettings/types";

export function getUserSettingsQueryKey(context?: Partial<UserSettingsAppContext> | null) {
  const resolved = resolveUserSettingsAppContext(context);
  return ["user-settings", "bootstrap", resolved.appSlug, resolved.citySlug, resolved.environment] as const;
}

export function useUserSettings(options?: {
  enabled?: boolean;
  appContext?: Partial<UserSettingsAppContext> | null;
}) {
  const { isAuthenticated } = useAuth();
  const appContext = resolveUserSettingsAppContext(options?.appContext);
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  const query = useQuery({
    queryKey: getUserSettingsQueryKey(appContext),
    queryFn: () => getUserSettingsBootstrap(appContext),
    enabled,
  });

  return {
    ...query,
    appContext,
    bootstrap: query.data ?? null,
  };
}
