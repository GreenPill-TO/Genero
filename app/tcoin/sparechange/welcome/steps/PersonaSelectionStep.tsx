import { usePersonas } from "@shared/api/hooks/usePersonas";
import { cn } from "@shared/utils/classnames";
import React, { useEffect } from "react";

interface PersonaSelectionStepProps {
  persona: string | null;
  handlePersonaSelection: (value: string) => void;
  setIsNextEnabled: (enabled: boolean) => void;
}

export const PersonaSelectionStep: React.FC<PersonaSelectionStepProps> = ({ persona, handlePersonaSelection, setIsNextEnabled }) => {
  const { personas, error, isLoading } = usePersonas();

  useEffect(() => {
    // Enable the next button if a persona is selected
    setIsNextEnabled(persona !== null);
  }, [persona, setIsNextEnabled]);

  return (
    <div className={cn("p-6 space-y-6")}>
      <h2 className="text-2xl font-bold mb-4">Choose your main reason for using SpareChange</h2>
      <div className="space-y-4">
        {personas &&
          !isLoading &&
          !error &&
          personas.map((p) => {
            return (
              <label key={p.sequential_id} className="block">
                <input
                  type="radio"
                  name="persona"
                  value={p.persona}
                  checked={persona === p.persona}
                  onChange={(e) => handlePersonaSelection(p.persona)}
                  className="mr-2"
                />
                {p.descr_long}
              </label>
            );
          })}
      </div>
    </div>
  );
};
