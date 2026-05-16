import React from "react";
import { Button } from "@shared/components/ui/Button";
import useDarkMode from "@shared/hooks/useDarkMode";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { LuMoon, LuSun, LuMonitor } from "react-icons/lu";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

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

  const options = [
    {
      id: "light" as const,
      title: "Light",
      description: "Bright surfaces with higher daytime contrast.",
      icon: LuSun,
      active: selectedTheme === "light",
    },
    {
      id: "dark" as const,
      title: "Dark",
      description: "Lower-glare surfaces for evening use.",
      icon: LuMoon,
      active: selectedTheme === "dark",
    },
    {
      id: "system" as const,
      title: "Follow system",
      description: "Match the appearance already set on this device.",
      icon: LuMonitor,
      active: isFollowingSystem,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Appearance</span>
        <p className="text-sm text-muted-foreground">
          Choose the theme that should feel most natural every time you open the wallet.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                walletChoiceCardClass,
                option.active
                  ? "border-teal-500/70 bg-teal-50 text-slate-950 shadow-[0_20px_44px_rgba(8,145,178,0.16)] dark:bg-teal-500/10 dark:text-white"
                  : ""
              )}
              onClick={() => void setTheme(option.id)}
              disabled={themeMutation.isPending}
            >
              <div className="space-y-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-current/10 bg-white/70 dark:bg-white/[0.08]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{option.title}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={walletPanelMutedClass}>
        <p className={walletSectionLabelClass}>Current selection</p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {isFollowingSystem
            ? `Following your device setting and currently showing ${isDarkMode ? "dark" : "light"} mode.`
            : `Using a fixed ${selectedTheme} theme for this wallet.`}
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={closeModal} className="rounded-full">
          Close
        </Button>
      </div>
    </div>
  );
}
