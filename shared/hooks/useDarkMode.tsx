"use client";
import { useState, useEffect } from "react";

import { Button } from "@shared/components/ui/Button";
import { LuMoon, LuSun } from "react-icons/lu";

export default function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleDarkMode = () => {
    const htmlElement = document.getElementById("main-content");
    if (isDarkMode) {
      htmlElement?.classList.remove("dark");
    } else {
      htmlElement?.classList.add("dark");
    }
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      const htmlElement = document.getElementById("main-content");
      if (htmlElement) {
        const hasDarkClass = htmlElement.classList.contains("dark");
        // Update state only if the class presence differs from the current state.
        setIsDarkMode(prev => (prev !== hasDarkClass ? hasDarkClass : prev));
      }
    }, 1000);

    // Cleanup the interval when the component unmounts.
    return () => clearInterval(intervalId);
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
