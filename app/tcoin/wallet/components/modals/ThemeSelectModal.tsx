import React from "react";
import { Button } from "@shared/components/ui/Button";
import useDarkMode from "@shared/hooks/useDarkMode";
import { LuMoon, LuSun, LuMonitor } from "react-icons/lu";

interface ThemeSelectModalProps {
  closeModal: () => void;
}

export function ThemeSelectModal({ closeModal }: ThemeSelectModalProps) {
  const { isDarkMode, isFollowingSystem, setThemeOverride, clearThemeOverride } = useDarkMode();

  const setTheme = (mode: "light" | "dark") => {
    setThemeOverride(mode);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose your preferred display theme.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={!isDarkMode && !isFollowingSystem ? "default" : "outline"}
          onClick={() => setTheme("light")}
        >
          <LuSun className="mr-2 h-4 w-4" /> Light
        </Button>
        <Button
          type="button"
          variant={isDarkMode && !isFollowingSystem ? "default" : "outline"}
          onClick={() => setTheme("dark")}
        >
          <LuMoon className="mr-2 h-4 w-4" /> Dark
        </Button>
        <Button type="button" variant={isFollowingSystem ? "default" : "outline"} onClick={clearThemeOverride}>
          <LuMonitor className="mr-2 h-4 w-4" /> Remove theme override
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={closeModal}>
          Close
        </Button>
      </div>
    </div>
  );
}
