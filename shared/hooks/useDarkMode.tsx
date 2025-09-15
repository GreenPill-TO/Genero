"use client";
import { useState, useEffect } from "react";

import { Button } from "@shared/components/ui/Button";
import { LuMoon, LuSun } from "react-icons/lu";

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const applyClass = (dark: boolean) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setIsDarkMode(dark);
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", next ? "dark" : "light");
    }
    applyClass(next);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theme");
    if (stored) {
      applyClass(stored === "dark");
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    applyClass(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => applyClass(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return { isDarkMode, toggleDarkMode };
}

export function ThemeToggleButton() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <Button onClick={() => toggleDarkMode()} className="p-2 mr-2" size="icon" variant="ghost">
      {isDarkMode ? <LuSun className="w-6 h-6" /> : <LuMoon className="w-6 h-6" />}
    </Button>
  );
}
