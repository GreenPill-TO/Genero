// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Button } from "@shared/components/ui/Button";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

interface Charity {
  id: string;
  name: string;
  value: string;
}

interface CharitySelectModalProps {
  closeModal: () => void;
  selectedCharity?: string;
  setSelectedCharity?: (v: string) => void;
}

const CharitySelectModal = ({
  closeModal,
  selectedCharity,
  setSelectedCharity,
}: CharitySelectModalProps) => {
  const { bootstrap } = useUserSettings();
  const savePreferences = useUpdateUserPreferencesMutation();
  const [charity, setCharity] = useState(selectedCharity ?? bootstrap?.preferences.charity ?? "");
  useEscapeKey(closeModal);

  useEffect(() => {
    setCharity(selectedCharity ?? bootstrap?.preferences.charity ?? "");
  }, [bootstrap?.preferences.charity, selectedCharity]);

  const handleSelect = async () => {
    if (!charity) {
      return;
    }

    await savePreferences.mutateAsync({
      charity,
      selectedCause: charity,
    });
    setSelectedCharity?.(charity);
    closeModal();
  };

  const charities: Charity[] =
    bootstrap?.options.charities.map((item) => ({
      id: item.id,
      name: item.name,
      value: item.value ?? item.name,
    })) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Default charity</span>
        <p className="text-sm text-muted-foreground">
          Choose the cause your wallet should support by default when a flow relies on your saved giving preference.
        </p>
      </div>

      <div className="space-y-3">
        {charities.length === 0 ? <p className="text-sm text-muted-foreground">No charities are available right now.</p> : null}
        {charities.map((ch) => {
          const selected = ch.name === charity;
          return (
            <button
              type="button"
              key={ch.id}
              className={cn(
                walletChoiceCardClass,
                "flex items-center justify-between gap-4",
                selected ? "border-teal-500/70 bg-teal-50 dark:bg-teal-500/10" : ""
              )}
              onClick={() => setCharity(ch.name)}
              aria-pressed={selected}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{ch.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected ? "Currently selected for this wallet." : "Use this charity as your default."}
                </p>
              </div>
              <span className={walletSectionLabelClass}>{selected ? "Selected" : "Available"}</span>
            </button>
          );
        })}

        <div className="flex justify-end space-x-2 pt-1">
          <Button variant="outline" onClick={closeModal} className="rounded-full">
            Cancel
          </Button>
          <Button onClick={() => void handleSelect()} className="rounded-full" disabled={savePreferences.isPending || !charity}>
            {savePreferences.isPending ? "Saving..." : "Select"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { CharitySelectModal };
