"use client";

import React from "react";
import { Button } from "@shared/components/ui/Button";
import useDarkMode from "@shared/hooks/useDarkMode";
import { LuMoon, LuSun } from "react-icons/lu";

export function ThemeToggleButton() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <Button onClick={() => toggleDarkMode()} className="p-2 mr-2" size="icon" variant="ghost">
      {isDarkMode ? <LuSun style={{ height: '26px', width: "26px" }} className="h-10 w-10" /> : <LuMoon style={{ height: '26px', width: "26px" }} className="w-10 h-10" />}
    </Button>
  );
}
