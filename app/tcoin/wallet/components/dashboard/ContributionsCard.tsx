import React from "react";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { CharitySelectModal } from "@tcoin/wallet/components/modals";

export function ContributionsCard({
  selectedCharity,
  setSelectedCharity,
  charityData,
  openModal,
  closeModal,
}: {
  selectedCharity: string;
  setSelectedCharity: (charity: string) => void;
  charityData: {
    personalContribution: number;
    allUsersToCharity: number;
    allUsersToAllCharities: number;
  };
  openModal: any;
  closeModal: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Charitable Contributions</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2 relative h-full">
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
        <Button
          variant="default"
          className="py-1 h-auto bottom-0 left-0 font-normal"
          onClick={() => {
            openModal({
              content: (
                <CharitySelectModal
                  closeModal={closeModal}
                  selectedCharity={selectedCharity}
                  setSelectedCharity={setSelectedCharity}
                />
              ),
              title: "Change Default Charity",
              description: "Select a new default charity for your contributions.",
            });
          }}
        >
          Change
        </Button>
      </CardContent>
    </Card>
  );
}
