import React from "react";
import { Button } from "@shared/components/ui/Button";

interface CharityContributionsModalProps {
  closeModal: () => void;
  selectedCharity: string;
  charityData: {
    personalContribution: number;
    allUsersToCharity: number;
    allUsersToAllCharities: number;
  };
  onChangeCharity: () => void;
}

export function CharityContributionsModal({
  closeModal,
  selectedCharity,
  charityData,
  onChangeCharity,
}: CharityContributionsModalProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <p>
          My default charity: <strong>{selectedCharity}</strong>
        </p>
        <p>
          My contribution to {selectedCharity}: {charityData.personalContribution} TCOIN
        </p>
        <p>
          All users to {selectedCharity}: {charityData.allUsersToCharity} TCOIN
        </p>
        <p>
          All users to all charities: {charityData.allUsersToAllCharities} TCOIN
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={closeModal}>
          Close
        </Button>
        <Button
          onClick={() => {
            closeModal();
            onChangeCharity();
          }}
        >
          Change Default Charity
        </Button>
      </div>
    </div>
  );
}
