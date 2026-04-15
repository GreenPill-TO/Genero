import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useModal } from "@shared/contexts/ModalContext";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useCurrentWalletAddress } from "@shared/hooks/useCurrentWalletAddress";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import {
  LuArrowUpRight,
  LuBuilding2,
  LuChevronRight,
  LuClipboardList,
  LuCopy,
  LuDollarSign,
  LuFlaskConical,
  LuHeart,
  LuHistory,
  LuMapPin,
  LuPalette,
  LuShield,
  LuShuffle,
  LuUser,
  LuWallet,
} from "react-icons/lu";
import { useControlPlaneAccess } from "@shared/api/hooks/useControlPlaneAccess";
import { useRouter } from "next/navigation";
import { getMerchantApplicationStatus } from "@shared/lib/edge/merchantApplicationsClient";
import { updateVoucherPreferences } from "@shared/lib/edge/voucherPreferencesClient";
import { toast } from "react-toastify";
import {
  walletActionRowClass,
  walletActionRowIconClass,
  walletBadgeClass,
  walletMetricTileClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "./authenticated-ui";

const DEFAULT_CHARITY_DATA = {
  personalContribution: 50,
  allUsersToCharity: 600,
  allUsersToAllCharities: 7000,
};

interface MoreTabProps {
  tokenLabel?: string;
  onOpenHistory?: () => void;
}

function shortenAddress(address: string) {
  if (address.length <= 16) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatThemeLabel(theme: string | null | undefined) {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "Follow system";
}

const PUBLIC_USERS_COLUMNS = [
  "id",
  "cubid_id",
  "username",
  "email",
  "phone",
  "full_name",
  "address",
  "bio",
  "profile_image_url",
  "has_completed_intro",
  "is_new_user",
  "is_admin",
  "auth_user_id",
  "cubid_score",
  "cubid_identity",
  "cubid_score_details",
  "user_identifier",
  "given_names",
  "family_name",
  "nickname",
  "country",
  "created_at",
  "updated_at",
] as const;

const WIDE_PUBLIC_USERS_COLUMNS = new Set<(typeof PUBLIC_USERS_COLUMNS)[number]>([
  "cubid_score",
  "cubid_identity",
  "cubid_score_details",
]);

function formatPublicUserValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function MoreTab({ tokenLabel = "TCOIN", onOpenHistory }: MoreTabProps) {
  const { openModal, closeModal } = useModal();
  const { userData, authData } = useAuth();
  const { bootstrap } = useUserSettings();
  const { walletAddress: senderWallet } = useCurrentWalletAddress({
    enabled: Boolean(userData?.cubidData?.id),
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
      await updateVoucherPreferences(
        {
          merchantStoreId:
            voucherPreferenceForm.merchantStoreId.trim() === ""
              ? null
              : Number.parseInt(voucherPreferenceForm.merchantStoreId, 10),
          tokenAddress: voucherPreferenceForm.tokenAddress.trim() || null,
          trustStatus: voucherPreferenceForm.trustStatus,
        },
        { citySlug: "tcoin" }
      );
      toast.success("Voucher routing preference saved.");
    } catch (error) {
      console.error("Failed to save voucher preference", error);
      toast.error("We could not save that voucher routing preference.");
    } finally {
      setIsSavingVoucherPreference(false);
    }
  };

  const openOffRampModal = async () => {
    const { OffRampModal } = await import("@tcoin/wallet/components/modals/OffRampModal");
    openModal({
      content: <OffRampModal closeModal={closeModal} userBalance={userBalance} />,
      title: "Convert and Off-ramp",
      description: `Convert your ${tokenLabel.toUpperCase()} to CAD and transfer to your bank account.`,
    });
  };

  const openCharitySelectModal = async () => {
    const { CharitySelectModal } = await import("@tcoin/wallet/components/modals/CharitySelectModal");
    openModal({
      content: <CharitySelectModal closeModal={closeModal} />,
      title: "Change Default Charity",
      description: "Choose the charity your wallet should support by default.",
    });
  };

  const openCharityContributionsModal = async () => {
    const { CharityContributionsModal } = await import("@tcoin/wallet/components/modals/CharityContributionsModal");
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
      description: "Review your contribution defaults and the impact connected to this wallet.",
    });
  };

  const openProfileModal = async () => {
    const { UserProfileModal } = await import("@tcoin/wallet/components/modals/UserProfileModal");
    openModal({
      content: <UserProfileModal closeModal={closeModal} />,
      isResponsive: true,
      elSize: "5xl",
      title: "Edit Profile",
      description: "Update your name, photo, username, and account details.",
    });
  };

  const openThemeModal = async () => {
    const { ThemeSelectModal } = await import("@tcoin/wallet/components/modals/ThemeSelectModal");
    openModal({
      content: <ThemeSelectModal closeModal={closeModal} />,
      title: "Select Theme",
      description: "Choose how the wallet should look on this device and across future sign-ins.",
    });
  };

  const openBiaPreferencesModal = async () => {
    const { BiaPreferencesModal } = await import("@tcoin/wallet/components/modals/BiaPreferencesModal");
    openModal({
      content: <BiaPreferencesModal closeModal={closeModal} />,
      title: "BIA Preferences",
      description: "Choose the neighbourhoods that should influence discovery and voucher routing defaults.",
    });
  };

  const openVoucherRoutingPreferencesModal = async () => {
    const { VoucherRoutingPreferencesModal } = await import(
      "@tcoin/wallet/components/modals/VoucherRoutingPreferencesModal"
    );
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
      description: "Control how this wallet handles trusted, blocked, and default voucher paths.",
    });
  };

  const openFutureAppFeaturesModal = async () => {
    const { FutureAppFeaturesModal } = await import("@tcoin/wallet/components/modals/FutureAppFeaturesModal");
    openModal({
      content: <FutureAppFeaturesModal />,
      title: "Future app features",
      description: "Preview experimental tools and reporting views that are still in development.",
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

  const handleOpenStats = () => {
    router.push("/stats");
  };

  const copyWalletAddress = async () => {
    if (!senderWallet) {
      toast.error("Your wallet address is not ready yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(senderWallet);
      toast.success("Wallet address copied.");
    } catch (error) {
      console.error("Failed to copy wallet address", error);
      toast.error("We could not copy your wallet address.");
    }
  };

  const displayName =
    bootstrap?.user?.nickname?.trim() ||
    userData?.cubidData?.nickname?.trim() ||
    bootstrap?.user?.firstName?.trim() ||
    userData?.cubidData?.given_names?.trim() ||
    bootstrap?.user?.fullName?.trim() ||
    userData?.cubidData?.full_name?.trim() ||
    "Wallet member";
  const username = bootstrap?.user?.username ? `@${bootstrap.user.username}` : null;
  const email = bootstrap?.user?.email ?? null;
  const avatarUrl = bootstrap?.user?.profileImageUrl ?? undefined;
  const avatarFallback = displayName.charAt(0).toUpperCase() || "W";
  const selectedTheme = formatThemeLabel(bootstrap?.preferences.theme);
  const selectedCharity = bootstrap?.preferences.charity ?? "Not set";
  const primaryBiaLabel =
    bootstrap?.options.bias.find((bia) => bia.id === bootstrap?.preferences.primaryBiaId)?.name ?? "Not set";

  const explorerBaseUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.example.com/address/";
  const explorerHref = senderWallet ? `${explorerBaseUrl}${senderWallet}` : null;
  const publicUserRows = useMemo(() => {
    const cubidData = userData?.cubidData;
    const userRecord: Record<(typeof PUBLIC_USERS_COLUMNS)[number], unknown> = {
      id: bootstrap?.user.id ?? cubidData?.id ?? null,
      cubid_id: bootstrap?.user.cubidId ?? cubidData?.cubid_id ?? null,
      username: bootstrap?.user.username ?? cubidData?.username ?? null,
      email: bootstrap?.user.email ?? cubidData?.email ?? null,
      phone: bootstrap?.user.phone ?? cubidData?.phone ?? null,
      full_name: bootstrap?.user.fullName ?? cubidData?.full_name ?? null,
      address: cubidData?.address ?? null,
      bio: cubidData?.bio ?? null,
      profile_image_url: bootstrap?.user.profileImageUrl ?? cubidData?.profile_image_url ?? null,
      has_completed_intro: bootstrap?.user.hasCompletedIntro ?? cubidData?.has_completed_intro ?? null,
      is_new_user: bootstrap?.user.isNewUser ?? cubidData?.is_new_user ?? null,
      is_admin: cubidData?.is_admin ?? null,
      auth_user_id: cubidData?.auth_user_id ?? authData?.user?.id ?? null,
      cubid_score: cubidData?.cubid_score ?? null,
      cubid_identity: cubidData?.cubid_identity ?? null,
      cubid_score_details: cubidData?.cubid_score_details ?? null,
      user_identifier: bootstrap?.user.userIdentifier ?? cubidData?.user_identifier ?? null,
      given_names: bootstrap?.user.firstName ?? cubidData?.given_names ?? null,
      family_name: bootstrap?.user.lastName ?? cubidData?.family_name ?? null,
      nickname: bootstrap?.user.nickname ?? cubidData?.nickname ?? null,
      country: bootstrap?.user.country ?? cubidData?.country ?? null,
      created_at: cubidData?.created_at ?? null,
      updated_at: cubidData?.updated_at ?? null,
    };

    return PUBLIC_USERS_COLUMNS.map((column) => ({
      column,
      value: formatPublicUserValue(userRecord[column]),
    }));
  }, [authData?.user?.id, bootstrap, userData?.cubidData]);

  const accountActions = [
    {
      title: "Edit Profile",
      description: "Update your name, photo, username, and country.",
      icon: LuUser,
      onClick: openProfileModal,
      meta: username ?? "Account details",
    },
    {
      title: "Select Theme",
      description: "Choose light, dark, or system appearance.",
      icon: LuPalette,
      onClick: openThemeModal,
      meta: selectedTheme,
    },
  ];

  const moneyActions = [
    {
      title: "Convert to CAD and Cash Out",
      description: "Move money out of your wallet with confirmation and bank-transfer details in one flow.",
      icon: LuDollarSign,
      onClick: openOffRampModal,
      meta: `${userBalance.toFixed(2)} ${tokenLabel.toUpperCase()} available`,
    },
    {
      title: "Voucher Routing Preferences",
      description: "Control trusted, blocked, and default voucher paths for merchants and tokens.",
      icon: LuShuffle,
      onClick: openVoucherRoutingPreferencesModal,
      meta: "Routing rules",
    },
  ];

  const communityActions = [
    {
      title: "Charity Contributions",
      description: "Review your current charity defaults and contribution totals, then change them if needed.",
      icon: LuHeart,
      onClick: openCharityContributionsModal,
      meta: selectedCharity,
    },
    {
      title: "BIA Preferences",
      description: "Choose the neighbourhoods that shape local discovery and voucher defaults.",
      icon: LuMapPin,
      onClick: openBiaPreferencesModal,
      meta: primaryBiaLabel,
    },
  ];

  const workspaceActions = [
    {
      title: "Stats for Nerds",
      description: "Open the shared analytics page for wallet, market, BIA, and indexer telemetry.",
      icon: LuClipboardList,
      onClick: handleOpenStats,
      meta: "Read-only stats",
    },
    {
      title: merchantActionLabel,
      description: "Start, continue, or manage your merchant workspace from the same wallet account.",
      icon: LuBuilding2,
      onClick: handleOpenMerchant,
      meta: "Merchant tools",
    },
    ...(canAccessCityManager
      ? [
          {
            title: "Open City Admin",
            description: "Review merchant applications and keep neighbourhood approvals moving.",
            icon: LuClipboardList,
            onClick: handleOpenCityAdmin,
            meta: "Operator access",
          },
        ]
      : []),
    ...(canAccessAdminDashboard
      ? [
          {
            title: "Open Admin Dashboard",
            description: "Handle on-ramp, off-ramp, and control-plane operations.",
            icon: LuShield,
            onClick: handleOpenAdmin,
            meta: "Administrator",
          },
        ]
      : []),
    {
      title: "Future app features",
      description: "Preview experimental ideas and reporting surfaces still in development.",
      icon: LuFlaskConical,
      onClick: openFutureAppFeaturesModal,
      meta: "Preview",
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-4">
      <section className={`${walletPanelClass} overflow-hidden`}>
        <div
          data-testid="more-tab-overview-grid"
          className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.95fr)] min-[1850px]:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.74fr)_minmax(280px,0.74fr)]"
        >
          <div className="space-y-5">
            <span className={walletBadgeClass}>Account centre</span>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-16 w-16 rounded-[20px] border border-white/10">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                    {displayName}
                  </h2>
                  <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    {username ? <p className="truncate font-medium">{username}</p> : null}
                    {email ? <p className="truncate">{email}</p> : null}
                  </div>
                </div>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={openProfileModal}>
                Edit Profile
              </Button>
            </div>

            <div className={walletPanelMutedClass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className={walletSectionLabelClass}>Wallet address</p>
                  {senderWallet ? (
                    <>
                      <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                        {shortenAddress(senderWallet)}
                      </p>
                      <p className="break-all font-mono text-xs text-slate-500 dark:text-slate-300">
                        {senderWallet}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Your wallet address will appear here after wallet setup is complete.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={copyWalletAddress}>
                    <LuCopy className="mr-2 h-4 w-4" /> Copy address
                  </Button>
                  {explorerHref ? (
                    <Button asChild type="button" variant="outline" className="rounded-full">
                      <a href={explorerHref} target="_blank" rel="noopener noreferrer">
                        <LuArrowUpRight className="mr-2 h-4 w-4" /> View on Explorer
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 min-[1850px]:contents">
            <div className={walletMetricTileClass}>
              <p className={walletSectionLabelClass}>Current defaults</p>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-600 dark:text-slate-300">Theme</dt>
                  <dd className="text-sm font-semibold text-slate-950 dark:text-white">{selectedTheme}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-600 dark:text-slate-300">Default charity</dt>
                  <dd className="text-right text-sm font-semibold text-slate-950 dark:text-white">{selectedCharity}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-slate-600 dark:text-slate-300">Primary BIA</dt>
                  <dd className="text-right text-sm font-semibold text-slate-950 dark:text-white">{primaryBiaLabel}</dd>
                </div>
              </dl>
            </div>

            <div className={walletPanelMutedClass}>
              <p className={walletSectionLabelClass}>What this wallet optimises for</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li>Simple send and request flows with familiar labels and clear confirmation.</li>
                <li>One source of truth for your balance and current CAD estimate.</li>
                <li>Neighbourhood routing and charity defaults that work quietly in the background.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div
        data-testid="more-tab-actions-grid"
        className="grid gap-6 lg:gap-4 xl:grid-cols-2 min-[1850px]:grid-cols-3"
      >
        <ActionSection
          eyebrow="Account and appearance"
          title="Keep your account clear and familiar."
          description="The essentials people usually expect from a banking app live here."
        >
          {onOpenHistory ? (
            <div className="lg:hidden">
              <ActionRow
                title="History"
                description="Review completed transfers and payment requests on smaller screens."
                icon={LuHistory}
                meta="Recent activity"
                onClick={onOpenHistory}
              />
            </div>
          ) : null}
          {accountActions.map((action) => (
            <ActionRow key={action.title} {...action} />
          ))}
        </ActionSection>

        <ActionSection
          eyebrow="Money settings"
          title="Handle cash-out and routing in one place."
          description="These actions affect how money leaves your wallet and how voucher paths are handled."
        >
          {moneyActions.map((action) => (
            <ActionRow key={action.title} {...action} />
          ))}
        </ActionSection>

        <ActionSection
          eyebrow="Community defaults"
          title="Keep local preferences in the background."
          description="Your charity and neighbourhood choices should stay visible without getting in the way."
        >
          {communityActions.map((action) => (
            <ActionRow key={action.title} {...action} />
          ))}
        </ActionSection>

        <ActionSection
          eyebrow="Workspaces and previews"
          title="Open the specialist tools only when you need them."
          description="Merchant, operator, and experimental surfaces stay grouped here instead of crowding the main wallet."
        >
          {workspaceActions.map((action) => (
            <ActionRow key={action.title} {...action} />
          ))}
        </ActionSection>
      </div>

      <section className={`${walletPanelClass} space-y-4`} data-testid="more-tab-public-users-card">
        <div className="space-y-2">
          <p className={walletSectionLabelClass}>Public users row</p>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Current values from public.users
            </h3>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Every current public.users column is listed below. Known values are shown from the authenticated wallet
              state, and empty fields stay visible so missing data is easy to inspect.
            </p>
          </div>
        </div>

        <div className={`${walletPanelMutedClass} overflow-hidden p-0`}>
          <div className="grid grid-cols-[minmax(140px,220px)_minmax(0,1fr)] border-b border-white/10 bg-slate-950/[0.03] text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <div className="px-4 py-3">Column</div>
            <div className="px-4 py-3">Value</div>
          </div>
          <div className="divide-y divide-white/10">
            {publicUserRows.map(({ column, value }) => {
              const isEmpty = value.trim() === "";
              const isWideValue = WIDE_PUBLIC_USERS_COLUMNS.has(column);

              if (isWideValue) {
                return (
                  <div key={column} className="space-y-2 px-4 py-3" data-testid={`public-users-row-${column}`}>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{column}</div>
                    <div
                      className={`min-w-0 rounded-[18px] border border-white/10 px-3 py-3 font-mono text-xs leading-6 ${
                        isEmpty
                          ? "italic text-slate-400 dark:text-slate-500"
                          : "whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {isEmpty ? "Empty" : value}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={column}
                  className="grid grid-cols-[minmax(140px,220px)_minmax(0,1fr)] items-start gap-4 px-4 py-3"
                  data-testid={`public-users-row-${column}`}
                >
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{column}</div>
                  <div
                    className={`min-w-0 break-words text-sm ${
                      isEmpty ? "italic text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {isEmpty ? "Empty" : value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${walletPanelClass} space-y-4`}>
      <div className="space-y-2">
        <p className={walletSectionLabelClass}>{eyebrow}</p>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionRow({
  title,
  description,
  icon: Icon,
  meta,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={walletActionRowClass} onClick={onClick}>
      <span className={`${walletActionRowIconClass} row-span-2`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="min-w-0 pr-2 text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
      <div className="flex shrink-0 items-center gap-3 pl-2">
        {meta ? (
          <span className="hidden max-w-[150px] truncate text-right text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400 sm:block">
            {meta}
          </span>
        ) : null}
        <LuChevronRight className="h-5 w-5 text-slate-400 transition duration-200 group-hover:translate-x-0.5 dark:text-slate-500" />
      </div>
      <p className="col-[2/4] min-w-0 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </button>
  );
}
