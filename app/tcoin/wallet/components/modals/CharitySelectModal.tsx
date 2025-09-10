import { Button } from "@shared/components/ui/Button";
import { Radio } from "@shared/components/ui/Radio";
import { useState } from "react";
import useEscapeKey from "@shared/hooks/useEscapeKey";

interface CharitySelectModalProps {
  closeModal: () => void;
  selectedCharity: string;
  setSelectedCharity: (v: string) => void;
}

const charities = [
  { value: "The FoodBank", label: "The FoodBank", id: "charity1" },
  { value: "The Shelter", label: "The Shelter", id: "charity2" },
  { value: "Save the Trees", label: "Save the Trees", id: "charity3" },
];

const CharitySelectModal = ({ closeModal, selectedCharity, setSelectedCharity }: CharitySelectModalProps) => {
  const [charity, setCharity] = useState(selectedCharity);
  useEscapeKey(closeModal);

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        {charities.map((ch) => {
          return (
            <Radio
              name="charity-selection"
              key={ch.id}
              label={ch.label}
              value={ch.value}
              onValueChange={setCharity}
              id={ch.id}
              defaultChecked={ch.value === charity}
            />
          );
        })}

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              closeModal();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setSelectedCharity(charity);
              closeModal();
            }}
          >
            Select
          </Button>
        </div>
      </div>
    </div>
  );
};

export { CharitySelectModal };
