import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { useModal } from "@shared/contexts/ModalContext";
import { useAuth } from "@shared/api/hooks/useAuth";
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
  LuDollarSign,
  LuFlaskConical,
  LuHeart,
  LuMapPin,
  LuPalette,
  LuShield,
  LuShuffle,
  LuUser,
} from "react-icons/lu";
import { hasAdminAccess } from "@shared/utils/access";
import { useRouter } from "next/navigation";

const DEFAULT_CHARITY_DATA = {
  personalContribution: 50,
  allUsersToCharity: 600,
  allUsersToAllCharities: 7000,
};

export function MoreTab({ tokenLabel = "TCOIN" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const { senderWallet } = useSendMoney({
    senderId: userData?.cubidData?.id ?? 0,
    receiverId: null,
  });
  const { balance: rawBalance } = useTokenBalance(senderWallet ?? null);
  const userBalance = Number.parseFloat(rawBalance) || 0;
  const activeProfile = userData?.cubidData?.activeProfile;
  const router = useRouter();
  const [selectedCharity, setSelectedCharity] = useState("None");
  const [biaOptions, setBiaOptions] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [primaryBiaId, setPrimaryBiaId] = useState<string>("");
  const [secondaryBiaIds, setSecondaryBiaIds] = useState<string[]>([]);
  const [isSavingBiaSelection, setIsSavingBiaSelection] = useState(false);
  const [voucherPreferenceForm, setVoucherPreferenceForm] = useState({
    merchantStoreId: "",
    tokenAddress: "",
    trustStatus: "default",
  });
  const [isSavingVoucherPreference, setIsSavingVoucherPreference] = useState(false);
  const charityData = useMemo(() => DEFAULT_CHARITY_DATA, []);

  useEffect(() => {
    const charityName = activeProfile?.charityPreferences?.charity;
    if (typeof charityName === "string" && charityName.trim() !== "") {
      setSelectedCharity(charityName);
    }
  }, [activeProfile?.charityPreferences?.charity]);

  useEffect(() => {
    const loadBiaSelection = async () => {
      try {
        const response = await fetch("/api/bias/list?citySlug=tcoin", {
          credentials: "include",
        });
        const body = await response.json();
        if (!response.ok) return;

        const options = Array.isArray(body?.bias)
          ? body.bias
              .filter((row: any) => typeof row?.id === "string")
              .map((row: any) => ({
                id: String(row.id),
                code: typeof row.code === "string" ? row.code : "BIA",
                name: typeof row.name === "string" ? row.name : row.id,
              }))
          : [];
        setBiaOptions(options);

        if (body?.activeAffiliation?.biaId) {
          setPrimaryBiaId(String(body.activeAffiliation.biaId));
        } else if (options.length > 0) {
          setPrimaryBiaId(options[0].id);
        }

        const secondaries = Array.isArray(body?.secondaryAffiliations)
          ? body.secondaryAffiliations
              .map((row: any) => (typeof row?.biaId === "string" ? row.biaId : null))
              .filter((row: string | null): row is string => row != null)
          : [];
        setSecondaryBiaIds(secondaries);
      } catch {
        setBiaOptions([]);
      }
    };

    void loadBiaSelection();
  }, []);

  const toggleSecondaryBia = (biaId: string) => {
    setSecondaryBiaIds((prev) => {
      if (prev.includes(biaId)) {
        return prev.filter((value) => value !== biaId);
      }
      return [...prev, biaId];
    });
  };

  const saveBiaSelection = async () => {
    if (!primaryBiaId) {
      return;
    }

    setIsSavingBiaSelection(true);
    try {
      const response = await fetch("/api/bias/select", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          citySlug: "tcoin",
          biaId: primaryBiaId,
          secondaryBiaIds: secondaryBiaIds.filter((biaId) => biaId !== primaryBiaId),
          source: "user_selected",
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Failed to save BIA selection.");
      }
    } catch (error) {
      console.error("Failed to save BIA selection", error);
    } finally {
      setIsSavingBiaSelection(false);
    }
  };

  const saveVoucherPreference = async () => {
    setIsSavingVoucherPreference(true);
    try {
      await fetch("/api/vouchers/preferences", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          citySlug: "tcoin",
          merchantStoreId:
            voucherPreferenceForm.merchantStoreId.trim() === ""
              ? null
              : Number.parseInt(voucherPreferenceForm.merchantStoreId, 10),
          tokenAddress: voucherPreferenceForm.tokenAddress.trim() || null,
          trustStatus: voucherPreferenceForm.trustStatus,
        }),
      });
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

  const openBiaPreferencesModal = () => {
    openModal({
      content: (
        <BiaPreferencesModal
          closeModal={closeModal}
          biaOptions={biaOptions}
          primaryBiaId={primaryBiaId}
          secondaryBiaIds={secondaryBiaIds}
          setPrimaryBiaId={setPrimaryBiaId}
          toggleSecondaryBia={toggleSecondaryBia}
          onSave={saveBiaSelection}
          isSaving={isSavingBiaSelection}
        />
      ),
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

  const isAdmin = hasAdminAccess(userData?.cubidData?.is_admin ?? userData?.user?.is_admin);

  const handleOpenAdmin = () => {
    router.push("/admin");
  };

  const handleOpenMerchant = () => {
    router.push("/merchant");
  };

  return (
    <div className="lg:px-[25vw]">
      <Card>
        <CardHeader>
          <CardTitle>More</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
            <LuBuilding2 className="mr-2 h-4 w-4" /> Open Merchant Dashboard
          </Button>
          {isAdmin && (
            <Button type="button" className="w-full justify-start" onClick={handleOpenAdmin}>
              <LuShield className="mr-2 h-4 w-4" /> Open Admin Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
