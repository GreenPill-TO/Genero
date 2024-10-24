import { Button } from "@shared/components/ui/Button";
import InfoBox from "@shared/components/ui/InfoBox";
import React from "react";

interface FinalWelcomeStepProps {
  onDashboardRedirect: () => void;
}

export const FinalWelcomeStep: React.FC<FinalWelcomeStepProps> = ({ onDashboardRedirect }) => {
  return (
    <div className="final-welcome-step">
      <h2 className="text-2xl font-bold">You're All Set!</h2>
      <InfoBox message="Your account is ready to go. You can now start exploring, donating, or receiving support!" />
      <Button onClick={onDashboardRedirect}>Go to Dashboard</Button>
    </div>
  );
};
