"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@shared/components/ui/Button";
import {
  applyThemePreference,
  migrateLegacyThemePreference,
  readCachedThemePreference,
  resolveSystemPrefersDark,
  writeCachedThemePreference,
} from "@shared/lib/userSettings/theme";
import type { UserSettingsTheme } from "@shared/lib/userSettings/types";
import { LuMoon, LuSun } from "react-icons/lu";

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFollowingSystem, setIsFollowingSystem] = useState(true);
  const [themeMode, setThemeMode] = useState<UserSettingsTheme>("system");
  const themeModeRef = useRef<UserSettingsTheme>("system");

  const applyMode = useCallback((mode: UserSettingsTheme) => {
    const resolvedDark = applyThemePreference(mode);
    themeModeRef.current = mode;
    setThemeMode(mode);
    setIsFollowingSystem(mode === "system");
    setIsDarkMode(resolvedDark);
  }, []);

  const setThemeOverride = (mode: "light" | "dark") => {
    writeCachedThemePreference(mode);
    applyMode(mode);
  };

  const toggleDarkMode = () => {
    setThemeOverride(isDarkMode ? "light" : "dark");
  };

  const clearThemeOverride = () => {
    writeCachedThemePreference("system");
    applyMode("system");
  };

  const syncThemePreference = (mode: UserSettingsTheme) => {
    writeCachedThemePreference(mode);
    applyMode(mode);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const cachedTheme = readCachedThemePreference() ?? migrateLegacyThemePreference() ?? "system";
    applyMode(cachedTheme);

    const listener = (e: MediaQueryListEvent) => {
      if (themeModeRef.current !== "system") {
        return;
      }

      setIsFollowingSystem(true);
      setIsDarkMode(e.matches);
      applyThemePreference("system");
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [applyMode]);

  useEffect(() => {
    if (themeMode !== "system") {
      return;
    }

    setIsDarkMode(resolveSystemPrefersDark());
  }, [themeMode]);

  return { isDarkMode, isFollowingSystem, themeMode, toggleDarkMode, setThemeOverride, clearThemeOverride, syncThemePreference };
}

export function ThemeToggleButton() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <Button onClick={() => toggleDarkMode()} className="p-2 mr-2" size="icon" variant="ghost">
      {isDarkMode ? <LuSun className="w-6 h-6" /> : <LuMoon className="w-6 h-6" />}
    </Button>
  );
}
