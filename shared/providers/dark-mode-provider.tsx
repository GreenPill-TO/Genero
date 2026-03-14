"use client";

import useDarkMode from "@shared/hooks/useDarkMode";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { readLegacyThemePreference } from "@shared/lib/userSettings/theme";
import { ReactNode } from "react";
import { useEffect, useRef } from "react";

export default function DarkModeProvider({ children }: { children: ReactNode }) {
  const { bootstrap } = useUserSettings();
  const { themeMode, syncThemePreference } = useDarkMode();
  const migrateLegacyTheme = useUpdateUserPreferencesMutation();
  const didAttemptLegacyMigration = useRef(false);

  useEffect(() => {
    const serverTheme = bootstrap?.preferences.theme;
    if (!serverTheme || serverTheme === themeMode) {
      return;
    }

    syncThemePreference(serverTheme);
  }, [bootstrap?.preferences.theme, syncThemePreference, themeMode]);

  useEffect(() => {
    if (didAttemptLegacyMigration.current) {
      return;
    }

    if (!bootstrap || bootstrap.preferences.theme !== "system") {
      return;
    }

    const legacyTheme = readLegacyThemePreference();
    if (!legacyTheme) {
      didAttemptLegacyMigration.current = true;
      return;
    }

    didAttemptLegacyMigration.current = true;
    migrateLegacyTheme.mutate({ theme: legacyTheme });
  }, [bootstrap, migrateLegacyTheme]);

  return <>{children}</>;
}
