import InfoBox from "@shared/components/ui/InfoBox";
import React, { useEffect } from "react";

interface ReceiveDonationsStepProps {
  setIsNextEnabled: (enabled: boolean) => void;
  nextStep: () => void;
}

export const ReceiveDonationsStep: React.FC<ReceiveDonationsStepProps> = ({ setIsNextEnabled }) => {
  useEffect(() => {
    // Enable the "Next" button as there is no input to validate
    setIsNextEnabled(true);
  }, [setIsNextEnabled]);

  return (
    <div className="receive-donations-step">
      <h2 className="text-2xl font-bold">Receive Donations & Tips</h2>
      <InfoBox message="Here's how you can receive donations and tips from generous supporters:" />
      <p>1. Share your profile link.</p>
      <p>2. Receive tips directly to your account.</p>
      <p>3. Withdraw funds at any time.</p>
    </div>
  );
};
