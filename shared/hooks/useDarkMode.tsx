"use client";
import { useState, useEffect } from "react";


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

