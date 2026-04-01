import React from "react";
import { Button } from "@shared/components/ui/Button";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

type BiaOption = {
  id: string;
  code: string;
  name: string;
};

type BiaPreferencesModalProps = {
  closeModal: () => void;
};

export function BiaPreferencesModal({ closeModal }: BiaPreferencesModalProps) {
  const { bootstrap } = useUserSettings();
  const savePreferences = useUpdateUserPreferencesMutation();
  const biaOptions: BiaOption[] = bootstrap?.options.bias ?? [];
  const [primaryBiaId, setPrimaryBiaId] = React.useState<string>(bootstrap?.preferences.primaryBiaId ?? "");
  const [secondaryBiaIds, setSecondaryBiaIds] = React.useState<string[]>(bootstrap?.preferences.secondaryBiaIds ?? []);
  const hasOptions = biaOptions.length > 0;

  React.useEffect(() => {
    setPrimaryBiaId(bootstrap?.preferences.primaryBiaId ?? "");
    setSecondaryBiaIds(bootstrap?.preferences.secondaryBiaIds ?? []);
  }, [bootstrap?.preferences.primaryBiaId, bootstrap?.preferences.secondaryBiaIds]);

  const toggleSecondaryBia = (biaId: string) => {
    setSecondaryBiaIds((prev) => (prev.includes(biaId) ? prev.filter((value) => value !== biaId) : [...prev, biaId]));
  };

  const onSave = async () => {
    await savePreferences.mutateAsync({
      primaryBiaId: primaryBiaId || null,
      secondaryBiaIds: secondaryBiaIds.filter((biaId) => biaId !== primaryBiaId),
    });
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Neighbourhoods</span>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Your BIA selection helps personalize discovery and voucher routing toward the neighbourhood pools most relevant to you.
          </p>
          <p>
            Choose one primary BIA and optionally add nearby secondary BIAs. This does not restrict where you can spend.
          </p>
        </div>
      </div>

      {!hasOptions ? (
        <p className={`${walletPanelMutedClass} text-sm text-muted-foreground`}>
          No BIA options are available right now. Please try again shortly.
        </p>
      ) : (
        <div className="space-y-4">
          <div className={walletPanelMutedClass}>
            <label htmlFor="bia-primary" className={walletSectionLabelClass}>
              Primary BIA
            </label>
            <select
              id="bia-primary"
              value={primaryBiaId}
              onChange={(event) => setPrimaryBiaId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              {biaOptions.map((bia) => (
                <option key={bia.id} value={bia.id}>
                  {bia.code} · {bia.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <p className={walletSectionLabelClass}>Secondary BIAs</p>
            {biaOptions
              .filter((bia) => bia.id !== primaryBiaId)
              .map((bia) => (
                <label
                  key={bia.id}
                  className={cn(
                    walletChoiceCardClass,
                    "flex cursor-pointer items-center gap-3",
                    secondaryBiaIds.includes(bia.id)
                      ? "border-teal-500/70 bg-teal-50 dark:bg-teal-500/10"
                      : ""
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={secondaryBiaIds.includes(bia.id)}
                    onChange={() => toggleSecondaryBia(bia.id)}
                  />
                  <span className="text-sm">
                    {bia.code} · {bia.name}
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeModal} className="rounded-full">
          Close
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          className="rounded-full"
          disabled={savePreferences.isPending || !hasOptions || !primaryBiaId}
        >
          {savePreferences.isPending ? "Saving BIA Selection…" : "Save BIA Selection"}
        </Button>
      </div>
    </div>
  );
}
