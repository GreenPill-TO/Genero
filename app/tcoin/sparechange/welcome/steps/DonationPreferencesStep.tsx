// @ts-nocheck
import InputField from "@shared/components/ui/InputField";
import { Select } from "@shared/components/ui/Select";
import React, { useEffect } from "react";

interface DonationPreferencesStepProps {
  preferredDonationAmount: number; // Preferred donation amount in CAD
  defaultTip: number | null; // Default tip percentage
  goodTip: number | null; // Good tip percentage for excellent service
  selectedCause: string; // Selected cause from the dropdown
  setPreferredDonationAmount: (value: number) => void; // Setter for preferred donation amount
  setDefaultTip: (value: number | null) => void;
  setGoodTip: (value: number | null) => void;
  setSelectedCause: (value: string) => void;
  setIsNextEnabled: (enabled: boolean) => void;
  nextStep: () => void;
}

export const DonationPreferencesStep: React.FC<DonationPreferencesStepProps> = ({
  preferredDonationAmount,
  defaultTip,
  goodTip,
  selectedCause,
  setPreferredDonationAmount,
  setDefaultTip,
  setGoodTip,
  setSelectedCause,
  setIsNextEnabled,
}) => {
  useEffect(() => {
    // Enable the "Next" button only if all fields are filled
    const isComplete = preferredDonationAmount !== 0 && defaultTip !== null && goodTip !== null && selectedCause?.trim() !== "";
    setIsNextEnabled(isComplete);
  }, [preferredDonationAmount, defaultTip, goodTip, selectedCause, setIsNextEnabled]);

  const handleDefaultTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDefaultTip(value ? parseFloat(value) : null);
  };

  const handleGoodTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGoodTip(value ? parseFloat(value) : null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Customize Your Donation Preferences</h2>
      <InputField
        label="Preferred Donation Amount (CAD)"
        name="preferredDonationAmount"
        value={preferredDonationAmount}
        placeholder="$5.00"
        onChange={(e) => setPreferredDonationAmount(parseFloat(e.currentTarget.value))}
      />
      <InputField
        label="Default Tip Percentage"
        name="defaultTip"
        value={defaultTip ? defaultTip.toString() : ""}
        placeholder="15%"
        onChange={handleDefaultTipChange}
      />
      <InputField
        label="Good Tip Percentage for Excellent Service"
        name="goodTip"
        value={goodTip ? goodTip.toString() : ""}
        placeholder="25%"
        onChange={handleGoodTipChange}
      />
      <Select
        variant="bordered"
        label="Select Your Cause"
        name="selectedCause"
        value={selectedCause}
        onValueChange={(v) => setSelectedCause(v)}
        options={[
          { label: "Select", value: "" },
          { label: "Food Bank", value: "Food Bank" },
          { label: "Homelessness", value: "Homelessness" },
          { label: "Clothes", value: "Clothes" },
          { label: "Counselling", value: "Counselling" },
          { label: "Child services", value: "Child services" },
        ]}
      />
    </div>
  );
};
