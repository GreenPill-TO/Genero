"use client";
import { useState, useEffect } from "react";

import { Button } from "@shared/components/ui/Button";
import { LuMoon, LuSun } from "react-icons/lu";

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFollowingSystem, setIsFollowingSystem] = useState(true);

  const applyClass = (dark: boolean) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setIsDarkMode(dark);
  };

  const setThemeOverride = (mode: "light" | "dark") => {
    const next = mode === "dark";
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", next ? "dark" : "light");
      window.localStorage.setItem("theme_user_set", "1");
    }
    setIsFollowingSystem(false);
    applyClass(next);
  };

  const toggleDarkMode = () => {
    setThemeOverride(isDarkMode ? "light" : "dark");
  };

  const clearThemeOverride = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("theme");
    window.localStorage.removeItem("theme_user_set");
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsFollowingSystem(true);
    applyClass(mediaQuery.matches);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = window.localStorage.getItem("theme");
      const userSetTheme = window.localStorage.getItem("theme_user_set") === "1";

      if (userSetTheme && (stored === "dark" || stored === "light")) {
        setIsFollowingSystem(false);
        applyClass(stored === "dark");
        return;
      }

      setIsFollowingSystem(true);
      applyClass(mediaQuery.matches);
    };

    sync();
    const listener = (e: MediaQueryListEvent) => {
      const userSetTheme = window.localStorage.getItem("theme_user_set") === "1";
      if (!userSetTheme) {
        setIsFollowingSystem(true);
        applyClass(e.matches);
      }
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return { isDarkMode, isFollowingSystem, toggleDarkMode, setThemeOverride, clearThemeOverride };
}

export function ThemeToggleButton() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <Button onClick={() => toggleDarkMode()} className="p-2 mr-2" size="icon" variant="ghost">
      {isDarkMode ? <LuSun className="w-6 h-6" /> : <LuMoon className="w-6 h-6" />}
    </Button>
  );
}
