import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import {
  OffRampModal,
  CharitySelectModal,
  CharityContributionsModal,
  ThemeSelectModal,
  BiaPreferencesModal,
  VoucherRoutingPreferencesModal,
  FutureAppFeaturesModal,
} from "@tcoin/wallet/components/modals";
import { UserProfileModal } from "@tcoin/wallet/components/modals/UserProfileModal";
import {
  LuBuilding2,
  LuClipboardList,
  LuDollarSign,
  LuFlaskConical,
  LuHeart,
  LuMapPin,
  LuPalette,
  LuShield,
  LuShuffle,
  LuUser,
} from "react-icons/lu";
import { useControlPlaneAccess } from "@shared/api/hooks/useControlPlaneAccess";
import { useRouter } from "next/navigation";
import { getMerchantApplicationStatus } from "@shared/lib/edge/merchantApplicationsClient";
import { updateVoucherPreferences } from "@shared/lib/edge/voucherPreferencesClient";
import { walletPanelClass } from "./authenticated-ui";

const DEFAULT_CHARITY_DATA = {
  personalContribution: 50,
  allUsersToCharity: 600,
  allUsersToAllCharities: 7000,
};

export function MoreTab({ tokenLabel = "TCOIN" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const { bootstrap } = useUserSettings();
  const { senderWallet } = useSendMoney({
    senderId: userData?.cubidData?.id ?? 0,
    receiverId: null,
  });
  const { balance: rawBalance } = useTokenBalance(senderWallet ?? null);
  const userBalance = Number.parseFloat(rawBalance) || 0;
  const router = useRouter();
  const controlPlaneAccess = useControlPlaneAccess("tcoin");
  const [voucherPreferenceForm, setVoucherPreferenceForm] = useState({
    merchantStoreId: "",
    tokenAddress: "",
    trustStatus: "default",
  });
  const [isSavingVoucherPreference, setIsSavingVoucherPreference] = useState(false);
  const [merchantActionLabel, setMerchantActionLabel] = useState("Sign up as Merchant");
  const charityData = useMemo(() => DEFAULT_CHARITY_DATA, []);

  useEffect(() => {
    const loadMerchantActionState = async () => {
      try {
        const body = await getMerchantApplicationStatus({ citySlug: "tcoin" });
        const state = typeof body?.state === "string" ? body.state : "none";

        if (state === "none") {
          setMerchantActionLabel("Sign up as Merchant");
          return;
        }

        if (state === "draft") {
          setMerchantActionLabel("Continue Merchant Application");
          return;
        }

        setMerchantActionLabel("Open Merchant Dashboard");
      } catch {
        // Keep default CTA label when status lookup fails.
      }
    };

    void loadMerchantActionState();
  }, []);

  const saveVoucherPreference = async () => {
    setIsSavingVoucherPreference(true);
    try {
      await updateVoucherPreferences({
        merchantStoreId:
          voucherPreferenceForm.merchantStoreId.trim() === ""
            ? null
            : Number.parseInt(voucherPreferenceForm.merchantStoreId, 10),
        tokenAddress: voucherPreferenceForm.tokenAddress.trim() || null,
        trustStatus: voucherPreferenceForm.trustStatus,
      }, { citySlug: "tcoin" });
    } catch (error) {
      console.error("Failed to save voucher preference", error);
    } finally {
      setIsSavingVoucherPreference(false);
    }
  };

  const openOffRampModal = () => {
    openModal({
      content: <OffRampModal closeModal={closeModal} userBalance={userBalance} />,
      title: "Convert and Off-ramp",
      description: `Convert your ${tokenLabel.toUpperCase()} to CAD and transfer to your bank account.`,
    });
  };

  const openCharitySelectModal = () => {
    openModal({
      content: <CharitySelectModal closeModal={closeModal} />,
      title: "Change Default Charity",
      description: "Select a new default charity for your contributions.",
    });
  };

  const openCharityContributionsModal = () => {
    openModal({
      content: (
        <CharityContributionsModal
          closeModal={closeModal}
          selectedCharity={bootstrap?.preferences.charity ?? "None"}
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

  const openBiaPreferencesModal = () => {
    openModal({
      content: <BiaPreferencesModal closeModal={closeModal} />,
      title: "BIA Preferences",
      description: "Choose your primary and secondary BIAs to personalize neighbourhood-related routing and discovery.",
    });
  };

  const openVoucherRoutingPreferencesModal = () => {
    openModal({
      content: (
        <VoucherRoutingPreferencesModal
          closeModal={closeModal}
          voucherPreferenceForm={voucherPreferenceForm}
          setVoucherPreferenceForm={setVoucherPreferenceForm}
          onSave={saveVoucherPreference}
          isSaving={isSavingVoucherPreference}
        />
      ),
      title: "Voucher Routing Preferences",
      description: "Control trust/blocked/default routing behavior for merchant or token voucher paths.",
    });
  };

  const openFutureAppFeaturesModal = () => {
    openModal({
      content: <FutureAppFeaturesModal />,
      title: "Future app features",
      description: "Preview experimental dashboard visualizations using sample data.",
      elSize: "4xl",
      isResponsive: true,
    });
  };

  const canAccessCityManager = controlPlaneAccess.data?.canAccessCityManager === true;
  const canAccessAdminDashboard = controlPlaneAccess.data?.canAccessAdminDashboard === true;

  const handleOpenAdmin = () => {
    router.push("/admin");
  };

  const handleOpenMerchant = () => {
    router.push("/merchant");
  };

  const handleOpenCityAdmin = () => {
    router.push("/city-admin");
  };

  return (
    <div className="space-y-5">
      <section className={`${walletPanelClass} space-y-5`}>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Settings
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">More</h2>
          <p className="text-sm text-muted-foreground">
            Everything that changes how your wallet behaves lives here, with admin tools separated from everyday actions.
          </p>
        </div>
        <div className="space-y-3">
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
          <Button type="button" className="w-full justify-start" onClick={openBiaPreferencesModal}>
            <LuMapPin className="mr-2 h-4 w-4" /> BIA Preferences
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openVoucherRoutingPreferencesModal}>
            <LuShuffle className="mr-2 h-4 w-4" /> Voucher Routing Preferences
          </Button>
          <Button type="button" className="w-full justify-start" onClick={openFutureAppFeaturesModal}>
            <LuFlaskConical className="mr-2 h-4 w-4" /> Future app features
          </Button>
          <Button type="button" className="w-full justify-start" onClick={handleOpenMerchant}>
            <LuBuilding2 className="mr-2 h-4 w-4" /> {merchantActionLabel}
          </Button>
          {canAccessCityManager && (
            <Button type="button" className="w-full justify-start" onClick={handleOpenCityAdmin}>
              <LuClipboardList className="mr-2 h-4 w-4" /> Open City Admin
            </Button>
          )}
          {canAccessAdminDashboard && (
            <Button type="button" className="w-full justify-start" onClick={handleOpenAdmin}>
              <LuShield className="mr-2 h-4 w-4" /> Open Admin Dashboard
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
