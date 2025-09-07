"use client";
import { useState, useEffect } from "react";

import { Button } from "@shared/components/ui/Button";
import { LuMoon, LuSun } from "react-icons/lu";

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const applyClass = (dark: boolean) => {
    const htmlElement = document.getElementById("main-content");
    if (dark) {
      htmlElement?.classList.add("dark");
    } else {
      htmlElement?.classList.remove("dark");
    }
    setIsDarkMode(dark);
  };

  const toggleDarkMode = () => {
    applyClass(!isDarkMode);
  };

  useEffect(() => {
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
