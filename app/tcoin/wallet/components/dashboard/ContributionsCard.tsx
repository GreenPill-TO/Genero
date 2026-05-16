import React from "react";
import { Button } from "@shared/components/ui/Button";
import { walletPanelClass } from "./authenticated-ui";

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
    <section className={`${walletPanelClass} relative`}>
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Community impact
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">Charitable Contributions</h2>
        </div>
        <div className="space-y-2">
          <p className="text-sm">
            My default charity: <strong>{selectedCharity}</strong>
          </p>
          <p className="text-sm">
            My contribution to {selectedCharity}: {charityData.personalContribution} TCOIN
          </p>
          <p className="text-sm">
            All users to {selectedCharity}: {charityData.allUsersToCharity} TCOIN
          </p>
          <p className="text-sm">
            All users to all charities: {charityData.allUsersToAllCharities} TCOIN
          </p>
        </div>
        <Button
          variant="default"
          className="mt-2 h-11 rounded-full px-5 font-normal"
          onClick={async () => {
            const { CharitySelectModal } = await import(
              "@tcoin/wallet/components/modals/CharitySelectModal"
            );
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
      </div>
    </section>
  );
}
