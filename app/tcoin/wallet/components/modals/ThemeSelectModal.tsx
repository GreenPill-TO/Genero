import React from "react";
import { Button } from "@shared/components/ui/Button";
import useDarkMode from "@shared/hooks/useDarkMode";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { LuMoon, LuSun, LuMonitor } from "react-icons/lu";

interface ThemeSelectModalProps {
  closeModal: () => void;
}

export function ThemeSelectModal({ closeModal }: ThemeSelectModalProps) {
  const { bootstrap } = useUserSettings();
  const { isDarkMode, syncThemePreference } = useDarkMode();
  const themeMutation = useUpdateUserPreferencesMutation();
  const selectedTheme = bootstrap?.preferences.theme ?? "system";
  const isFollowingSystem = selectedTheme === "system";

  const setTheme = async (mode: "system" | "light" | "dark") => {
    syncThemePreference(mode);
    await themeMutation.mutateAsync({ theme: mode });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose your preferred display theme.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={selectedTheme === "light" ? "default" : "outline"}
          onClick={() => void setTheme("light")}
          disabled={themeMutation.isPending}
        >
          <LuSun className="mr-2 h-4 w-4" /> Light
        </Button>
        <Button
          type="button"
          variant={selectedTheme === "dark" || (selectedTheme === "system" && isDarkMode) ? "default" : "outline"}
          onClick={() => void setTheme("dark")}
          disabled={themeMutation.isPending}
        >
          <LuMoon className="mr-2 h-4 w-4" /> Dark
        </Button>
        <Button
          type="button"
          variant={isFollowingSystem ? "default" : "outline"}
          onClick={() => void setTheme("system")}
          disabled={themeMutation.isPending}
        >
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
