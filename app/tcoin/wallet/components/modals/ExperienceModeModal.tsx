import React from "react";
import { Button } from "@shared/components/ui/Button";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import type { UserSettingsExperienceMode } from "@shared/lib/userSettings/types";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

interface ExperienceModeModalProps {
  closeModal: () => void;
}

const OPTIONS: Array<{
  id: UserSettingsExperienceMode;
  title: string;
  description: string;
}> = [
  {
    id: "simple",
    title: "Clean and simple mode",
    description: "A quieter wallet that keeps the focus on balance and buying or topping up more TCOIN.",
  },
  {
    id: "advanced",
    title: "Advanced mode",
    description: "The full wallet with richer dashboard surfaces, more settings, and the broader toolset visible.",
  },
];

export function ExperienceModeModal({ closeModal }: ExperienceModeModalProps) {
  const { bootstrap } = useUserSettings();
  const preferencesMutation = useUpdateUserPreferencesMutation();
  const selectedMode = bootstrap?.preferences.experienceMode ?? "simple";

  const setExperienceMode = async (experienceMode: UserSettingsExperienceMode) => {
    await preferencesMutation.mutateAsync({ experienceMode });
  };

  return (
    <div className="space-y-5" data-testid="experience-mode-modal">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Wallet experience</span>
        <p className="text-sm text-muted-foreground">
          Choose whether this wallet should stay focused on the basics or keep the fuller set of controls visible.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cn(
              walletChoiceCardClass,
              selectedMode === option.id
                ? "border-teal-500/70 bg-teal-50 text-slate-950 shadow-[0_20px_44px_rgba(8,145,178,0.16)] dark:bg-teal-500/10 dark:text-white"
                : ""
            )}
            onClick={() => void setExperienceMode(option.id)}
            disabled={preferencesMutation.isPending}
          >
            <div className="space-y-2">
              <p className="text-base font-semibold">{option.title}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className={walletPanelMutedClass}>
        <p className={walletSectionLabelClass}>Current selection</p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {selectedMode === "simple"
            ? "Using the simpler daily-use wallet view."
            : "Using the fuller wallet with advanced tools visible."}
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
