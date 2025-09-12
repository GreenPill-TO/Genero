// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Radio } from "@shared/components/ui/Radio";
import { createClient } from "@shared/lib/supabase/client";
import useEscapeKey from "@shared/hooks/useEscapeKey";

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
  const supabase = createClient();
  const { userData } = useAuth()
  useEscapeKey(closeModal);

  useEffect(() => {
    const fetchCharities = async () => {
      const { data, error } = await supabase
        .from("charities")
        .select("*");
      if (error) {
        console.error("Error fetching charities:", error);
      } else if (data) {
        setCharities(data);
      }
    };

    fetchCharities();
  }, [supabase]);

  const handleSelect = async () => {
    // Update the parent component state
    setSelectedCharity(charity);

    // Get the current user

    // Update the charity column in the users table
    const { error } = await supabase
      .from("users")
      .update({ charity })
      .eq("id", userData?.cubidData?.id);
    if (error) {
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
