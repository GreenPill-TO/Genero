import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { useModal } from "@shared/contexts/ModalContext";
import { useAuth } from "@shared/api/hooks/useAuth";
import {
  TopUpModal,
  OffRampModal,
  CharitySelectModal,
  CharityContributionsModal,
  ThemeSelectModal,
} from "@tcoin/wallet/components/modals";
import { UserProfileModal } from "@tcoin/wallet/components/modals/UserProfileModal";
import { LuCreditCard, LuDollarSign, LuHeart, LuPalette, LuUser } from "react-icons/lu";

const DEFAULT_CHARITY_DATA = {
  personalContribution: 50,
  allUsersToCharity: 600,
  allUsersToAllCharities: 7000,
};

export function MoreTab({ tokenLabel = "TCOIN" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const [selectedCharity, setSelectedCharity] = useState("None");
  const charityData = useMemo(() => DEFAULT_CHARITY_DATA, []);

  useEffect(() => {
    const charityName = userData?.cubidData?.charity;
    if (typeof charityName === "string" && charityName.trim() !== "") {
      setSelectedCharity(charityName);
    }
  }, [userData?.cubidData?.charity]);

  const openTopUpModal = () => {
    openModal({
      content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
      title: "Top Up with Interac eTransfer",
      description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} balance.`,
    });
  };

  const openOffRampModal = () => {
    openModal({
      content: <OffRampModal closeModal={closeModal} />,
      title: "Convert and Off-ramp",
      description: "Convert your TCOIN to CAD and transfer to your bank account.",
    });
  };

  const openCharitySelectModal = () => {
    openModal({
      content: (
        <CharitySelectModal
          closeModal={closeModal}
          selectedCharity={selectedCharity}
          setSelectedCharity={(value: string) => {
            setSelectedCharity(value);
          }}
        />
      ),
      title: "Change Default Charity",
      description: "Select a new default charity for your contributions.",
    });
  };

  const openCharityContributionsModal = () => {
    openModal({
      content: (
        <CharityContributionsModal
          closeModal={closeModal}
          selectedCharity={selectedCharity}
          charityData={charityData}
          onChangeCharity={openCharitySelectModal}
        />
      ),
      title: "Charitable Contributions",
      description: "Review your contributions and manage your default charity.",
    });
  };

  const openProfileModal = () => {
    openModal({
      content: <UserProfileModal closeModal={closeModal} />,
      isResponsive: true,
      title: "Edit Profile",
      description: "Update your personal information and preferences.",
    });
  };

  const openThemeModal = () => {
    openModal({
      content: <ThemeSelectModal closeModal={closeModal} />,
      title: "Select Theme",
      description: "Switch between light and dark appearance modes.",
    });
  };

  return (
    <div className="lg:px-[25vw]">
      <Card>
        <CardHeader>
          <CardTitle>More</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" className="w-full justify-start" onClick={openTopUpModal}>
            <LuCreditCard className="mr-2 h-4 w-4" /> Top Up with Interac eTransfer
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openOffRampModal}>
            <LuDollarSign className="mr-2 h-4 w-4" /> Convert to CAD and Cash Out
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openCharityContributionsModal}>
            <LuHeart className="mr-2 h-4 w-4" /> Charity Contributions
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openProfileModal}>
            <LuUser className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openThemeModal}>
            <LuPalette className="mr-2 h-4 w-4" /> Select Theme
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
