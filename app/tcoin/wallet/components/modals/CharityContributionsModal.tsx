import React from "react";
import { Button } from "@shared/components/ui/Button";
import {
  walletBadgeClass,
  walletMetricTileClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";

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
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Community support</span>
        <div className={walletPanelMutedClass}>
          <p className={walletSectionLabelClass}>Default charity</p>
          <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{selectedCharity}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This charity is used whenever a wallet flow relies on your saved giving preference.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={walletMetricTileClass}>
          <p className={walletSectionLabelClass}>Your contribution</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {charityData.personalContribution}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">TCOIN directed from this wallet</p>
        </div>
        <div className={walletMetricTileClass}>
          <p className={walletSectionLabelClass}>All users to this charity</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {charityData.allUsersToCharity}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">TCOIN sent to {selectedCharity}</p>
        </div>
        <div className={walletMetricTileClass}>
          <p className={walletSectionLabelClass}>All charity contributions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {charityData.allUsersToAllCharities}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">TCOIN contributed across the network</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={closeModal} className="rounded-full">
          Close
        </Button>
        <Button
          className="rounded-full"
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
