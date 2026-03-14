// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Button } from "@shared/components/ui/Button";
import { Radio } from "@shared/components/ui/Radio";
import { useUpdateUserPreferencesMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import useEscapeKey from "@shared/hooks/useEscapeKey";

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
    <div className="mt-2 p-0">
      <div className="space-y-4">
        {charities.length === 0 ? <p className="text-sm text-muted-foreground">No charities are available right now.</p> : null}
        {charities.map((ch) => (
          <Radio
            name="charity-selection"
            key={ch.id}
            label={ch.name}
            value={ch.name}
            onValueChange={setCharity}
            id={ch.id}
            defaultChecked={ch.name === charity}
          />
        ))}

        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={() => void handleSelect()} disabled={savePreferences.isPending || !charity}>
            {savePreferences.isPending ? "Saving..." : "Select"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { CharitySelectModal };
