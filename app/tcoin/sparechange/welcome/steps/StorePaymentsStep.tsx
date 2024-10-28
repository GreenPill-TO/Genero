import InfoBox from "@shared/components/ui/InfoBox";
import React, { useEffect } from "react";

interface StorePaymentsStepProps {
  setIsNextEnabled: (enabled: boolean) => void;
  nextStep: () => void;
}

export const StorePaymentsStep: React.FC<StorePaymentsStepProps> = ({ setIsNextEnabled }) => {
  useEffect(() => {
    // Enable the "Next" button as there is no input to validate
    setIsNextEnabled(true);
  }, [setIsNextEnabled]);

  return (
    <div className="store-payments-step">
      <h2 className="text-2xl font-bold">Set Up Your Payments</h2>
      <InfoBox message="Here's how your store can receive payments:" />
      <p>1. Set up your payment method.</p>
      <p>2. Receive payments from customers.</p>
      <p>3. Access funds whenever you need them.</p>
    </div>
  );
};
