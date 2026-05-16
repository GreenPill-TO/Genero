"use client";

import React from "react";
import { Button } from "@shared/components/ui/Button";
import useDarkMode from "@shared/hooks/useDarkMode";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import type { UserSettingsTheme } from "@shared/lib/userSettings/types";
import { LuLaptop, LuMoon, LuSun } from "react-icons/lu";

const THEME_SEQUENCE: UserSettingsTheme[] = ["system", "light", "dark"];

const THEME_LABELS: Record<UserSettingsTheme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function getNextTheme(themeMode: UserSettingsTheme): UserSettingsTheme {
  const currentIndex = THEME_SEQUENCE.indexOf(themeMode);
  return THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
}

export function ThemeToggleButton() {
  const { bootstrap } = useUserSettings();
  const { themeMode, syncThemePreference } = useDarkMode();
  const themeMutation = useUpdateUserPreferencesMutation();
  const nextTheme = getNextTheme(themeMode);

  const handleToggle = async () => {
    syncThemePreference(nextTheme);
    if (bootstrap) {
      await themeMutation.mutateAsync({ theme: nextTheme });
    }
  };

  const iconClassName = "h-[26px] w-[26px]";
  const currentThemeLabel = THEME_LABELS[themeMode];
  const nextThemeLabel = THEME_LABELS[nextTheme];

  const icon =
    themeMode === "system" ? (
      <LuLaptop aria-hidden="true" className={iconClassName} />
    ) : themeMode === "dark" ? (
      <LuMoon aria-hidden="true" className={iconClassName} />
    ) : (
      <LuSun aria-hidden="true" className={iconClassName} />
    );

  return (
    <Button
      type="button"
      onClick={() => void handleToggle()}
      className="mr-2 rounded-full border border-white/10 bg-white/70 p-2 text-slate-700 hover:bg-white dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
      size="icon"
      variant="ghost"
      aria-label={`Theme: ${currentThemeLabel}. Switch to ${nextThemeLabel}.`}
      title={`Theme: ${currentThemeLabel}. Switch to ${nextThemeLabel}.`}
      data-testid="theme-toggle-button"
    >
      {icon}
      <span className="sr-only">{`Theme: ${currentThemeLabel}`}</span>
    </Button>
  );
}
