import React from "react";
import { Button } from "@shared/components/ui/Button";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";

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
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Your BIA selection helps us personalize local discovery and route certain voucher-related recommendations to
          neighbourhood pools that are most relevant to you.
        </p>
        <p>
          Choose one primary BIA and optionally add secondary BIAs for nearby areas you also frequent. This does not
          restrict where you can spend.
        </p>
      </div>

      {!hasOptions ? (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          No BIA options are available right now. Please try again shortly.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="bia-primary" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Primary BIA
            </label>
            <select
              id="bia-primary"
              value={primaryBiaId}
              onChange={(event) => setPrimaryBiaId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {biaOptions.map((bia) => (
                <option key={bia.id} value={bia.id}>
                  {bia.code} · {bia.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Secondary BIAs</p>
            {biaOptions
              .filter((bia) => bia.id !== primaryBiaId)
              .map((bia) => (
                <label key={bia.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={secondaryBiaIds.includes(bia.id)}
                    onChange={() => toggleSecondaryBia(bia.id)}
                  />
                  <span>
                    {bia.code} · {bia.name}
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeModal}>
          Close
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={savePreferences.isPending || !hasOptions || !primaryBiaId}
        >
          {savePreferences.isPending ? "Saving BIA Selection…" : "Save BIA Selection"}
        </Button>
      </div>
    </div>
  );
}
