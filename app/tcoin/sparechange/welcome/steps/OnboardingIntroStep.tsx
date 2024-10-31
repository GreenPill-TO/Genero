import { Button } from "@shared/components/ui/Button";
import IconList from "@shared/components/ui/IconList";
import InfoBox from "@shared/components/ui/InfoBox";
import React from "react";
import { FaHandHoldingHeart, FaHeart, FaRecycle, FaShoppingCart } from "react-icons/fa";

interface OnboardingIntroStepProps {
  nextStep: () => void;
}

export const OnboardingIntroStep: React.FC<OnboardingIntroStepProps> = ({ nextStep }) => {
  return (
    <div className={`p-6 space-y-6`}>
      <h2 className="text-2xl font-bold">Welcome to SpareChange!</h2>
      <InfoBox message="SpareChange helps you receive or give support within your community. Here's how it works:" />
      <IconList
        items={[
          { icon: FaHeart, text: "Support those in need" },
          { icon: FaHandHoldingHeart, text: "Receive help from your community" },
          { icon: FaShoppingCart, text: "Shop in stores using community currency" },
          {
            icon: FaRecycle,
            text: "Contribute to a circular economy when stores pay their employees with community currency",
          },
        ]}
      />
      <div className="flex justify-end mt-4">
        <Button onClick={nextStep} variant="secondary">
          Let's Get Started
        </Button>
      </div>
    </div>
  );
};
