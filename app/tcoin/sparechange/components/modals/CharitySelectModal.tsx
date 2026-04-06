// @ts-nocheck
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Radio } from "@shared/components/ui/Radio";
import { useState, useEffect } from "react";
import { getUserSettingsBootstrap, updateUserPreferences } from "@shared/lib/userSettings/client";

interface Charity {
  id: string;
  name: string;
  value: string;
}

interface CharitySelectModalProps {
  closeModal: () => void;
  selectedCharity: string;
  setSelectedCharity: (v: string) => void;
}

const CharitySelectModal = ({
  closeModal,
  selectedCharity,
  setSelectedCharity,
}: CharitySelectModalProps) => {
  const [charity, setCharity] = useState(selectedCharity);
  const [charities, setCharities] = useState<Charity[]>([]);
  const { userData } = useAuth();

  useEffect(() => {
    const fetchCharities = async () => {
      try {
        const bootstrap = await getUserSettingsBootstrap();
        const data = bootstrap.options.charities.map((entry) => ({
          id: entry.id,
          name: entry.name,
          value: entry.value ?? entry.name,
        }));
        setCharities(data);
      } catch (error) {
        console.error("Error fetching charities:", error);
      }
    };

    fetchCharities();
  }, []);

  const handleSelect = async () => {
    setSelectedCharity(charity);

    try {
      await updateUserPreferences({
        charity,
        selectedCause: charity,
      });
    } catch (error) {
      console.error("Error updating user's charity:", error);
    }

    closeModal();
  };

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
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
          <Button onClick={handleSelect}>Select</Button>
        </div>
      </div>
    </div>
  );
};

export { CharitySelectModal };
