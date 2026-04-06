// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Select, { type StylesConfig } from "react-select";
import countryList from "react-select-country-list";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import {
  normaliseDeviceInfo,
  serialiseUserShare,
} from "@shared/api/services/supabaseService";
import { registerWalletCustody } from "@shared/lib/edge/userSettingsClient";
import { useCompleteUserSignupMutation, useResetUserSignupMutation, useSaveUserSignupStepMutation, useStartUserSignupMutation } from "@shared/hooks/useUserSettingsMutations";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useModal } from "@shared/contexts/ModalContext";
import { TCOIN_WELCOME_VIDEO_URL } from "@shared/lib/supabase/assets";
import { dialCodes } from "@shared/utils/countryDialCodes";
import { cn } from "@shared/utils/classnames";
import { uploadProfilePicture } from "@shared/lib/supabase/profilePictures";
import {
  createCroppedProfilePictureFile,
  getProfilePictureCropFrame,
  prepareProfilePicture,
  revokePreparedProfilePicturePreview,
  type PreparedProfilePicture,
  type ProfilePictureCropState,
} from "@shared/lib/profilePictureCrop";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { fileInputFieldClass, nativeFieldClass, reactSelectFieldShellClass } from "@shared/components/ui/formFieldStyles";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";
import WelcomeProfilePictureEditorModal from "@tcoin/wallet/components/modals/WelcomeProfilePictureEditorModal";
import { LuUser } from "react-icons/lu";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletPageClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import type { UserSettingsExperienceMode } from "@shared/lib/userSettings/types";
import { resolveCubidRuntimeUserId } from "@shared/types/cubid";

const WalletComponent = dynamic(() => import("cubid-wallet").then((mod) => mod.WalletComponent), { ssr: false });
const CubidWidget = dynamic(() => import("cubid-sdk").then((mod) => mod.CubidWidget), { ssr: false });

type CountryOption = {
  value: string;
  label: string;
};

type UserDetailsFormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  username: string;
  country: CountryOption | null;
};

type CommunitySettingsForm = {
  charity: string;
  selectedCause: string;
  primaryBiaId: string;
  secondaryBiaIds: string[];
};

const DEFAULT_CROP_STATE: ProfilePictureCropState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
};

const SIGNUP_AVATAR_PREVIEW_SIZE = 96;
const SIGNUP_PLACEHOLDER_ROTATION_MS = 3000;
const DEFAULT_CHARITY_NAME = "Universal Basic Income";
const SIGNUP_FLOW_VERSION = "general-user-v2";
const SIGNUP_PLACEHOLDER_NAMES = [
  "Mats Sundin",
  "Nathan Philips",
  "The Weeknd",
  "Carlton The Bear",
  "Mel Lastman",
  "Kyle Lowry",
  "John Candy",
  "Joe Carter",
  "Drake",
  "Wayne Gretzky",
  "Rob Ford",
  "Larry Tannenbaum",
  "Olivia Chow",
];
const DEFAULT_SIGNUP_COUNTRY = "CA";

const buildCountryOptions = (): CountryOption[] => {
  const data = countryList().getData();
  return data.map((option) => {
    const dialCode = dialCodes[option.value as keyof typeof dialCodes];
    return {
      value: option.value,
      label: dialCode ? `${option.label} (${dialCode})` : option.label,
    };
  });
};

const getInitialCountryOption = (country: string | null | undefined, options: CountryOption[]): CountryOption | null => {
  if (!country) {
    return null;
  }

  const normalised = country.trim().toLowerCase();
  return (
    options.find((option) => option.label.toLowerCase() === normalised || option.value.toLowerCase() === normalised) ?? null
  );
};

const getDefaultSignupCountryOption = (options: CountryOption[]) =>
  options.find((option) => option.value === DEFAULT_SIGNUP_COUNTRY) ?? null;

const splitFullName = (fullName: string | null | undefined) => {
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() ?? "",
    lastName: parts.join(" "),
  };
};

const createUsernamePlaceholder = (fullName: string) =>
  fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "") || "tcoin.user";

const getDetectedBrowserName = () => {
  if (typeof navigator === "undefined") {
    return "Unknown browser";
  }

  const brands = navigator.userAgentData?.brands
    ?.map((brand) => brand.brand)
    .filter((brand) => brand && brand.toLowerCase() !== "not a brand");

  if (brands?.length) {
    return brands.join(", ");
  }

  const userAgent = navigator.userAgent;
  if (/edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Google Chrome";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  if (/firefox\//i.test(userAgent)) return "Firefox";

  return "Unknown browser";
};

const getDetectedDeviceDetails = () => {
  if (typeof navigator === "undefined") {
    return {
      platform: "Unknown platform",
      browser: "Unknown browser",
      label: "Unknown device",
    };
  }

  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "Unknown platform";
  const browser = getDetectedBrowserName();
  return {
    platform,
    browser,
    label: `${browser} on ${platform}`,
  };
};

export default function WelcomePage() {
  const router = useRouter();
  const { userData, authData, isAuthenticated } = useAuth();
  const { bootstrap, isLoading, refetch } = useUserSettings();
  const { openModal, closeModal } = useModal();
  const startSignup = useStartUserSignupMutation();
  const saveSignupStep = useSaveUserSignupStepMutation();
  const resetSignup = useResetUserSignupMutation();
  const completeSignup = useCompleteUserSignupMutation();
  const [showWizard, setShowWizard] = useState(false);
  const [showResetIntro, setShowResetIntro] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [walletReadyLocal, setWalletReadyLocal] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [profilePictureSelection, setProfilePictureSelection] = useState<PreparedProfilePicture | null>(null);
  const [profilePictureCrop, setProfilePictureCrop] = useState<ProfilePictureCropState>(DEFAULT_CROP_STATE);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isPreparingProfilePicture, setIsPreparingProfilePicture] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const signupProfilePictureInputRef = useRef<HTMLInputElement | null>(null);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettingsForm>({
    charity: "",
    selectedCause: "",
    primaryBiaId: "",
    secondaryBiaIds: [],
  });
  const [experienceModeChoice, setExperienceModeChoice] = useState<UserSettingsExperienceMode | "">("");
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const defaultSignupCountryOption = useMemo(() => getDefaultSignupCountryOption(countryOptions), [countryOptions]);
  const totalSteps = 7;
  const canSkipWalletSetup = ["development", "local"].includes(
    (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase()
  );
  const usernameValueFromBootstrap = bootstrap?.user.username ?? "";
  const currentStep = bootstrap?.signup.currentStep ?? wizardStep;
  const walletReady = bootstrap?.signup.walletReady === true || walletReadyLocal;
  const pendingPaymentIntent = bootstrap?.signup.pendingPaymentIntent ?? null;
  const cubidRuntimeUserId = resolveCubidRuntimeUserId(userData?.cubidData ?? userData?.user);
  const activePlaceholderName = SIGNUP_PLACEHOLDER_NAMES[placeholderIndex] ?? SIGNUP_PLACEHOLDER_NAMES[0];
  const rotatingNamePlaceholder = useMemo(() => splitFullName(activePlaceholderName), [activePlaceholderName]);
  const nicknamePlaceholder = rotatingNamePlaceholder.firstName || activePlaceholderName;
  const usernamePlaceholder = useMemo(() => createUsernamePlaceholder(activePlaceholderName), [activePlaceholderName]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserDetailsFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      nickname: "",
      username: "",
      country: defaultSignupCountryOption,
    },
  });

  const watchedFirstName = watch("firstName");
  const watchedLastName = watch("lastName");
  const watchedNickname = watch("nickname");
  const watchedUsername = watch("username");
  const watchedCountry = watch("country");
  const hasStartedTypingDetails = [watchedFirstName, watchedLastName, watchedNickname, watchedUsername].some((value) =>
    value?.trim()
  );

  const countrySelectStyles = useMemo<StylesConfig<CountryOption, false>>(
    () => ({
      control: (base) => ({
        ...base,
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderRadius: "0.75rem",
        minHeight: "2.5rem",
        boxShadow: "none",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 0.75rem",
      }),
      input: (base) => ({
        ...base,
        color: "inherit",
      }),
      placeholder: (base) => ({
        ...base,
        color: "hsl(var(--muted-foreground))",
      }),
      singleValue: (base) => ({
        ...base,
        color: "inherit",
      }),
      menu: (base) => ({
        ...base,
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow:
          "0 20px 45px -24px rgba(15, 23, 42, 0.45), 0 12px 20px -18px rgba(15, 23, 42, 0.24)",
      }),
      menuList: (base) => ({
        ...base,
        padding: "0.35rem",
      }),
      option: (base, state) => ({
        ...base,
        borderRadius: "0.85rem",
        backgroundColor: state.isFocused ? "hsl(var(--accent))" : "transparent",
        color: state.isFocused ? "hsl(var(--accent-foreground))" : "inherit",
      }),
    }),
    []
  );

  useEffect(() => {
    if (bootstrap?.signup.state === "completed") {
      router.replace(
        pendingPaymentIntent ? "/dashboard?tab=send&resumePayment=1" : "/dashboard"
      );
    }
  }, [bootstrap?.signup.state, pendingPaymentIntent, router]);

  useEffect(() => {
    if (hasStartedTypingDetails) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((currentIndex) => (currentIndex + 1) % SIGNUP_PLACEHOLDER_NAMES.length);
    }, SIGNUP_PLACEHOLDER_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [hasStartedTypingDetails]);

  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    const nameParts = splitFullName(bootstrap.user.fullName);
    const shouldPrepopulateDetails = bootstrap.signup.state === "draft" || bootstrap.signup.state === "completed";
    reset({
      firstName: shouldPrepopulateDetails ? nameParts.firstName : "",
      lastName: shouldPrepopulateDetails ? nameParts.lastName : "",
      nickname: shouldPrepopulateDetails ? bootstrap.user.nickname ?? "" : "",
      username: shouldPrepopulateDetails ? bootstrap.user.username ?? "" : "",
      country: shouldPrepopulateDetails
        ? getInitialCountryOption(bootstrap.user.country, countryOptions) ?? defaultSignupCountryOption
        : defaultSignupCountryOption,
    });
    setWizardStep(bootstrap.signup.currentStep ?? 1);
    setPhoneVerified(bootstrap.signup.phoneVerified);
    setCommunitySettings({
      charity: bootstrap.preferences.charity ?? "",
      selectedCause: bootstrap.preferences.selectedCause ?? bootstrap.preferences.charity ?? "",
      primaryBiaId: bootstrap.preferences.primaryBiaId ?? "",
      secondaryBiaIds: bootstrap.preferences.secondaryBiaIds ?? [],
    });
    const shouldPreselectExperienceMode =
      bootstrap.preferences.hasExplicitExperienceMode || bootstrap.signup.flow !== SIGNUP_FLOW_VERSION;
    setExperienceModeChoice(shouldPreselectExperienceMode ? bootstrap.preferences.experienceMode : "");
  }, [bootstrap, countryOptions, defaultSignupCountryOption, reset]);

  useEffect(() => {
    if (!showWizard && bootstrap?.signup.state === "draft") {
      setWizardStep(bootstrap.signup.currentStep ?? 1);
    }
  }, [bootstrap?.signup.currentStep, bootstrap?.signup.state, showWizard]);

  useEffect(() => {
    if (authData?.user?.email && !watch("username") && !usernameValueFromBootstrap) {
      const candidate = authData.user.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (candidate) {
        reset(
          {
            ...watch(),
            username: candidate,
          },
          {
            keepDirty: false,
            keepTouched: true,
          }
        );
      }
    }
  }, [authData?.user?.email, reset, usernameValueFromBootstrap, watch]);

  useEffect(() => {
    if (profilePictureSelection) {
      return;
    }
    const source = typeof bootstrap?.user.profileImageUrl === "string" ? bootstrap.user.profileImageUrl.trim() : "";
    setProfilePicturePreview(source || null);
  }, [bootstrap?.user.profileImageUrl, profilePictureSelection]);

  useEffect(() => {
    return () => {
      if (profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePicturePreview);
      }
      revokePreparedProfilePicturePreview(profilePictureSelection);
    };
  }, [profilePicturePreview, profilePictureSelection]);

  const getDeviceMetadata = (customLabel?: string) => {
    if (typeof navigator === "undefined") {
      return null;
    }

    const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "Unknown platform";
    let autoLabel = platform;
    if (navigator.userAgentData?.brands) {
      const brandLabel = navigator.userAgentData.brands.map((brand) => brand.brand).filter(Boolean).join(", ");
      if (brandLabel) {
        autoLabel = `${brandLabel} on ${platform}`;
      }
    } else {
      autoLabel = `${platform} - ${navigator.userAgent.slice(0, 48)}`;
    }

    return normaliseDeviceInfo({
      userAgent: navigator.userAgent,
      platform,
      label: customLabel || autoLabel,
    });
  };

  const insertOrUpdateDataInWallet = async (_userId, data) => {
    const result = await registerWalletCustody({
      namespace: data.namespace || "EVM",
      publicKey: typeof data.public_key === "string" ? data.public_key : undefined,
      isGenerated: typeof data.is_generated === "boolean" ? data.is_generated : undefined,
      appShare: typeof data.app_share === "string" ? data.app_share : undefined,
      walletKeyId: typeof data.wallet_key_id === "number" ? data.wallet_key_id : undefined,
    });

    return result.walletKeyId;
  };

  const goToNextStep = (nextBootstrap?: any) => {
    const nextStep = nextBootstrap?.signup.currentStep ?? Math.min(totalSteps, wizardStep + 1);
    setWizardStep(nextStep);
  };

  const handleStart = async () => {
    try {
      const next = await startSignup.mutateAsync();
      setShowResetIntro(false);
      setShowWizard(true);
      setWizardStep(next.signup.currentStep ?? 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start signup.");
    }
  };

  const handleReset = async () => {
    try {
      const next = await resetSignup.mutateAsync();
      revokePreparedProfilePicturePreview(profilePictureSelection);
      setProfilePictureSelection(null);
      setProfilePictureCrop(DEFAULT_CROP_STATE);
      setProfilePicturePreview(null);
      setExperienceModeChoice("");
      setShowResetIntro(next.signup.state === "none");
      setShowWizard(false);
      setWizardStep(1);
      toast.success("Signup reset.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset signup.");
    }
  };

  const saveWelcomeStep = async () => {
    try {
      const next = await saveSignupStep.mutateAsync({
        step: 1,
        payload: { introAccepted: true },
      });
      setShowResetIntro(false);
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this step.");
    }
  };

  const saveUserDetailsStep = async (values: UserDetailsFormValues) => {
    try {
      const next = await saveSignupStep.mutateAsync({
        step: 2,
        payload: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          nickname: values.nickname.trim() || null,
          username: values.username.trim() ? values.username.trim().toLowerCase() : null,
          country: values.country?.label ?? values.country?.value ?? null,
          phoneVerified,
        },
      });
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your details.");
    }
  };

  const saveCommunitySettingsStep = async () => {
    try {
      const fallbackCharity = communitySettings.charity || defaultCharityOption?.name || defaultCharityOption?.value || "";

      if (!communitySettings.charity && fallbackCharity) {
        setCommunitySettings((prev) => ({
          ...prev,
          charity: fallbackCharity,
          selectedCause: fallbackCharity,
        }));
      }

      const next = await saveSignupStep.mutateAsync({
        step: 4,
        payload: {
          charity: fallbackCharity,
          selectedCause: communitySettings.selectedCause || fallbackCharity,
          primaryBiaId: communitySettings.primaryBiaId,
          secondaryBiaIds: communitySettings.secondaryBiaIds.filter((biaId) => biaId !== communitySettings.primaryBiaId),
        },
      });
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save community settings.");
    }
  };

  const saveExperienceModeStep = async () => {
    if (!experienceModeChoice) {
      toast.error("Choose either clean and simple mode or advanced mode to continue.");
      return;
    }

    try {
      const next = await saveSignupStep.mutateAsync({
        step: 5,
        payload: {
          experienceMode: experienceModeChoice,
        },
      });
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your wallet experience mode.");
    }
  };

  const saveProfilePictureStep = async () => {
    if (!bootstrap?.user.id) {
      toast.error("We could not determine your account. Please try signing in again.");
      return;
    }

    try {
      setIsUploadingProfilePicture(true);
      let profileImageUrl =
        typeof bootstrap.user.profileImageUrl === "string" && bootstrap.user.profileImageUrl.trim()
          ? bootstrap.user.profileImageUrl
          : null;

      if (profilePictureSelection) {
        const croppedFile = await createCroppedProfilePictureFile({
          source: profilePictureSelection,
          crop: profilePictureCrop,
        });
        profileImageUrl = await uploadProfilePicture(bootstrap.user.id, croppedFile);
        setProfilePicturePreview(profileImageUrl);
      }

      const next = await saveSignupStep.mutateAsync({
        step: 3,
        payload: {
          profileImageUrl,
        },
      });
      goToNextStep(next);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (/name resolution failed|failed to fetch|network/i.test(errorMessage.toLowerCase())) {
        toast.error("We couldn't upload your photo right now. Please try again, or continue without one and add it later from Edit Profile.");
      } else {
        toast.error(error instanceof Error ? error.message : "Unable to save your profile picture.");
      }
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const saveWalletStep = async (skipWalletSetup = false) => {
    try {
      const next = await saveSignupStep.mutateAsync({
        step: 6,
        payload: {
          deviceLabel: deviceLabel.trim() || null,
          skipWalletSetup,
        },
      });
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : skipWalletSetup ? "Unable to skip wallet setup." : "Wallet setup is still incomplete.");
    }
  };

  const finishSignup = async () => {
    try {
      await completeSignup.mutateAsync();
      toast.success("Welcome to TCOIN.");
      router.push(
        pendingPaymentIntent ? "/dashboard?tab=send&resumePayment=1" : "/dashboard"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete signup.");
    }
  };

  const mainClass = cn(
    walletPageClass,
    "min-h-screen justify-center font-sans"
  );
  const selectedPrimaryBiaId = communitySettings.primaryBiaId;
  const defaultCharityOption =
    bootstrap?.options.charities.find(
      (charity) => charity.name === DEFAULT_CHARITY_NAME || charity.value === DEFAULT_CHARITY_NAME
    ) ?? null;
  const detectedDeviceDetails = useMemo(() => getDetectedDeviceDetails(), []);

  const openSignIn = () => {
    openModal({
      content: <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />,
      elSize: "4xl",
    });
  };

  if (isLoading && !bootstrap) {
    return (
      <div className={mainClass} data-testid="welcome-page-shell">
        <section className={`${walletPanelClass} mx-auto w-full max-w-3xl space-y-3`}>
          <span className={walletBadgeClass}>Wallet setup</span>
          <p className="text-sm text-muted-foreground">Loading welcome flow…</p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={mainClass} data-testid="welcome-page-shell">
        <section className={`${walletPanelClass} mx-auto w-full max-w-3xl space-y-6`}>
          <div className="space-y-3 text-center">
            <span className={walletBadgeClass}>Wallet setup</span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Welcome to TCOIN</h1>
              <p className="text-sm text-muted-foreground">Sign in to start or resume your wallet setup.</p>
            </div>
          </div>
          <div className={`${walletPanelMutedClass} space-y-4 text-sm text-muted-foreground`}>
            <p>Your signup is saved step by step once you authenticate.</p>
            <p>You will be able to add your user details, choose a profile picture, choose community settings, set up your wallet, and continue to the dashboard.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={openSignIn}>Authenticate</Button>
          </div>
        </section>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className={mainClass} data-testid="welcome-page-shell">
        <section className={`${walletPanelClass} mx-auto w-full max-w-3xl space-y-3`}>
          <span className={walletBadgeClass}>Wallet setup</span>
          <p className="text-sm text-muted-foreground">Unable to load your welcome flow.</p>
        </section>
      </div>
    );
  }

  const openProfilePictureEditor = (
    selection: PreparedProfilePicture,
    options?: {
      initialCrop?: ProfilePictureCropState;
      revokeOnCancel?: boolean;
    }
  ) => {
    openModal({
      content: (
        <WelcomeProfilePictureEditorModal
          selection={selection}
          initialCrop={options?.initialCrop ?? DEFAULT_CROP_STATE}
          closeModal={() => {
            if (options?.revokeOnCancel) {
              revokePreparedProfilePicturePreview(selection);
            }
            closeModal();
          }}
          onApply={(nextCrop) => {
            if (
              profilePictureSelection?.previewUrl &&
              profilePictureSelection.previewUrl !== selection.previewUrl &&
              profilePictureSelection.previewUrl.startsWith("blob:")
            ) {
              revokePreparedProfilePicturePreview(profilePictureSelection);
            }
            if (
              profilePicturePreview &&
              profilePicturePreview !== selection.previewUrl &&
              profilePicturePreview.startsWith("blob:")
            ) {
              URL.revokeObjectURL(profilePicturePreview);
            }
            setProfilePictureSelection(selection);
            setProfilePictureCrop(nextCrop);
            setProfilePicturePreview(selection.previewUrl);
          }}
        />
      ),
      elSize: "xl",
    });
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setIsPreparingProfilePicture(true);
      try {
        const preparedImage = await prepareProfilePicture(file);
        openProfilePictureEditor(preparedImage, {
          initialCrop: DEFAULT_CROP_STATE,
          revokeOnCancel: true,
        });
      } catch (error) {
        console.error("Error preparing profile picture", error);
        toast.error("We couldn't prepare that image. Please try another one.");
      } finally {
        setIsPreparingProfilePicture(false);
      }
      return;
    }
    const source = typeof bootstrap.user.profileImageUrl === "string" ? bootstrap.user.profileImageUrl.trim() : "";
    revokePreparedProfilePicturePreview(profilePictureSelection);
    setProfilePictureSelection(null);
    setProfilePictureCrop(DEFAULT_CROP_STATE);
    setProfilePicturePreview(source || null);
  };

  const openProfilePicturePicker = () => {
    signupProfilePictureInputRef.current?.click();
  };

  const signupAvatarPreviewFrame = profilePictureSelection
    ? getProfilePictureCropFrame({
        imageWidth: profilePictureSelection.width,
        imageHeight: profilePictureSelection.height,
        cropSize: SIGNUP_AVATAR_PREVIEW_SIZE,
        offsetX: profilePictureCrop.offsetX,
        offsetY: profilePictureCrop.offsetY,
        zoom: profilePictureCrop.zoom,
      })
    : null;

  return (
    <div className={mainClass} data-testid="welcome-page-shell">
      {!showWizard && (bootstrap.signup.state === "none" || showResetIntro) ? (
        <section className={`${walletPanelClass} mx-auto w-full max-w-3xl space-y-6`} data-testid="welcome-primary-panel">
          <div className="space-y-3 text-center">
            <span className={walletBadgeClass}>Wallet setup</span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Welcome to TCOIN</h1>
              <p className="text-sm text-muted-foreground">A local currency designed to build up our communities instead of extracting from them.</p>
            </div>
          </div>
          <div className={`${walletPanelMutedClass} space-y-4 text-sm text-muted-foreground`}>
            <p>Welcome to TCOIN, where we are trying to create a better local economic system around everyday Toronto life.</p>
            <p>TCOIN is pegged to local transit value so the currency stays intuitive in daily use and stable in value over time.</p>
            <p>You will be asked which charity you support, and from then on a small percentage of your TCOIN activity will keep contributing to that charity.</p>
            <p>Fun fact: when the TTC sold its first ticket, it cost 6 cents. If you could have held on to that ticket, you would have made approx 5,500% by now, or 4% per year.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleStart()} disabled={startSignup.isPending}>
              {startSignup.isPending ? "Starting..." : "Start setup"}
            </Button>
          </div>
        </section>
      ) : null}

      {!showWizard && bootstrap.signup.state === "draft" ? (
        <section className={`${walletPanelClass} mx-auto w-full max-w-3xl space-y-6`} data-testid="welcome-primary-panel">
          <div className="space-y-3 text-center">
            <span className={walletBadgeClass}>Saved draft</span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Resume your signup</h1>
              <p className="text-sm text-muted-foreground">You have a saved draft at step {currentStep} of {totalSteps}.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void handleReset()} disabled={resetSignup.isPending}>
              {resetSignup.isPending ? "Resetting..." : "Reset"}
            </Button>
            <Button
              onClick={() => {
                setShowResetIntro(false);
                setShowWizard(true);
                setWizardStep(currentStep);
              }}
            >
              Resume
            </Button>
          </div>
        </section>
      ) : null}

      {showWizard ? (
        <section className={`${walletPanelClass} mx-auto w-full max-w-4xl space-y-6`} data-testid="welcome-primary-panel">
          <div className="space-y-3 text-center">
            <span className={walletBadgeClass}>User signup</span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">User Signup</h1>
              <p className="text-sm text-muted-foreground">Step {wizardStep} of {totalSteps}</p>
            </div>
          </div>
          <div className="space-y-6">
            {wizardStep === 1 ? (
              <div className={`${walletPanelMutedClass} space-y-4 text-sm text-muted-foreground`}>
                <p>Let's set up your profile, community defaults, wallet experience, and wallet access together so the app is ready to use when you land in the dashboard.</p>
                <p>You will add your user details, choose a profile picture, pick your charity and neighbourhood preferences, choose a simpler or fuller wallet view, and then connect your wallet.</p>
                <p>Your progress is saved step by step, so if you leave part-way through you can come back and resume from where you stopped.</p>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <form className="space-y-4" onSubmit={handleSubmit(saveUserDetailsStep)}>
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                  <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`}>
                    <div className="space-y-1">
                      <p className={walletSectionLabelClass}>Required to continue</p>
                      <p className="text-sm text-muted-foreground">First name, last name, country, and phone verification are required.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                          First name
                        </label>
                        <input
                          id="firstName"
                          placeholder={hasStartedTypingDetails ? "" : rotatingNamePlaceholder.firstName}
                          className={nativeFieldClass}
                          {...register("firstName", { required: "First name is required" })}
                        />
                        {errors.firstName ? <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p> : null}
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                          Last name
                        </label>
                        <input
                          id="lastName"
                          placeholder={hasStartedTypingDetails ? "" : rotatingNamePlaceholder.lastName}
                          className={nativeFieldClass}
                          {...register("lastName", { required: "Last name is required" })}
                        />
                        {errors.lastName ? <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p> : null}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium mb-1">
                        Country
                      </label>
                      <Controller
                        control={control}
                        name="country"
                        rules={{ required: "Country is required" }}
                        render={({ field }) => (
                          <Select
                            {...field}
                            inputId="country"
                            options={countryOptions}
                            placeholder="Select a country"
                            styles={countrySelectStyles}
                            className={reactSelectFieldShellClass}
                            value={field.value}
                            onChange={(option) => field.onChange(option)}
                          />
                        )}
                      />
                      {errors.country ? <p className="mt-1 text-xs text-red-500">{errors.country.message}</p> : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-black dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                      <p className="mb-2 text-sm font-medium">Phone verification</p>
                      {phoneVerified ? (
                        <p className="text-sm text-green-600">Phone verified. You are good to continue.</p>
                      ) : (
                        <>
                          <CubidWidget
                            stampToRender="phone"
                            uuid={cubidRuntimeUserId}
                            page_id="37"
                            api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                            onStampChange={() => setPhoneVerified(true)}
                          />
                          <p className="mt-2 text-xs text-gray-500">Enter your phone number and verify it with the code we send.</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`}>
                    <div className="space-y-1">
                      <p className={walletSectionLabelClass}>Optional for now</p>
                      <p className="text-sm text-muted-foreground">Preferred name and username can be added now or later.</p>
                    </div>
                    <div>
                      <label htmlFor="nickname" className="block text-sm font-medium mb-1">
                        Preferred name
                      </label>
                      <input
                        id="nickname"
                        placeholder={hasStartedTypingDetails ? "" : nicknamePlaceholder}
                        className={nativeFieldClass}
                        {...register("nickname")}
                      />
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium mb-1">
                        Username
                      </label>
                      <input
                        id="username"
                        placeholder={hasStartedTypingDetails ? "" : usernamePlaceholder}
                        className={nativeFieldClass}
                        {...register("username", {
                          maxLength: {
                            value: 32,
                            message: "Username must be 32 characters or fewer.",
                          },
                          validate: (value) =>
                            !value || /^[a-z0-9._-]+$/.test(value) || "Use only lowercase letters, numbers, dots, underscores or hyphens.",
                        })}
                      />
                      {errors.username ? <p className="mt-1 text-xs text-red-500">{errors.username.message}</p> : null}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      saveSignupStep.isPending ||
                      !phoneVerified ||
                      !watchedFirstName ||
                      !watchedLastName ||
                      !watchedCountry
                    }
                  >
                    {isSubmitting || saveSignupStep.isPending ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </form>
            ) : null}

            {wizardStep === 3 ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This photo will help senders and recipients identify and verify who you are in the wallet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Please choose a picture that looks like you so people can recognise you with confidence.
                    </p>
                  </div>
                  {profilePictureSelection && signupAvatarPreviewFrame ? (
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-muted">
                      <div
                        aria-hidden="true"
                        className="absolute max-w-none"
                        style={{
                          width: `${signupAvatarPreviewFrame.scaledWidth}px`,
                          height: `${signupAvatarPreviewFrame.scaledHeight}px`,
                          left: `${signupAvatarPreviewFrame.x}px`,
                          top: `${signupAvatarPreviewFrame.y}px`,
                          backgroundImage: `url(${profilePictureSelection.previewUrl})`,
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "100% 100%",
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={profilePicturePreview ? "Adjust profile picture" : "Add profile picture"}
                      className="rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={openProfilePicturePicker}
                    >
                      <Avatar className="h-24 w-24">
                        {profilePicturePreview ? (
                          <AvatarImage src={profilePicturePreview} alt="Profile picture preview" />
                        ) : (
                          <AvatarFallback>
                            <LuUser />
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </button>
                  )}
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Add a profile picture now, or continue and come back to it later from Edit Profile.
                    </p>
                    <label htmlFor="signupProfilePicture" className="block text-sm font-medium">
                      Choose a profile picture
                    </label>
                    <input
                      ref={signupProfilePictureInputRef}
                      id="signupProfilePicture"
                      name="signupProfilePicture"
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleProfilePictureChange(event)}
                      className={fileInputFieldClass}
                    />
                    {profilePictureSelection ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() =>
                          openProfilePictureEditor(profilePictureSelection, {
                            initialCrop: profilePictureCrop,
                            revokeOnCancel: false,
                          })
                        }
                      >
                        Adjust photo
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        We will open the picture editor right after you choose an image.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(2)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => void saveProfilePictureStep()} disabled={saveSignupStep.isPending || isUploadingProfilePicture}>
                    {saveSignupStep.isPending || isUploadingProfilePicture || isPreparingProfilePicture ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Transaction fees you pay here, in place of normal credit card fees, will go to a charity of your choice.
                  </p>
                  <label className="block text-sm font-medium mb-1">Default charity</label>
                  <select
                    value={communitySettings.charity}
                    onChange={(event) =>
                      setCommunitySettings((prev) => ({
                        ...prev,
                        charity: event.target.value,
                        selectedCause: event.target.value,
                      }))
                    }
                    className={nativeFieldClass}
                  >
                    <option value="">Select a charity</option>
                    {bootstrap.options.charities.map((charity) => (
                      <option key={charity.id} value={charity.name}>
                        {charity.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    We will filter and show you local merchants based on the BIA you select here.
                  </p>
                  <label className="block text-sm font-medium mb-1">Primary BIA</label>
                  <select
                    value={communitySettings.primaryBiaId}
                    onChange={(event) =>
                      setCommunitySettings((prev) => ({
                        ...prev,
                        primaryBiaId: event.target.value,
                        secondaryBiaIds: prev.secondaryBiaIds.filter((biaId) => biaId !== event.target.value),
                      }))
                    }
                    className={nativeFieldClass}
                  >
                    <option value="">Select a BIA</option>
                    {bootstrap.options.bias.map((bia) => (
                      <option key={bia.id} value={bia.id}>
                        {bia.code} · {bia.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Secondary BIAs</p>
                  <div className="space-y-2">
                    {bootstrap.options.bias
                      .filter((bia) => bia.id !== selectedPrimaryBiaId)
                      .map((bia) => (
                        <label key={bia.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={communitySettings.secondaryBiaIds.includes(bia.id)}
                            onChange={() =>
                              setCommunitySettings((prev) => ({
                                ...prev,
                                secondaryBiaIds: prev.secondaryBiaIds.includes(bia.id)
                                  ? prev.secondaryBiaIds.filter((value) => value !== bia.id)
                                  : [...prev.secondaryBiaIds, bia.id],
                              }))
                            }
                          />
                          <span>
                            {bia.code} · {bia.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(3)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveCommunitySettingsStep()}
                    disabled={saveSignupStep.isPending || !communitySettings.primaryBiaId}
                  >
                    {saveSignupStep.isPending ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="space-y-5">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Choose the wallet experience that should greet you every time you open TCOIN.
                  </p>
                  <p>
                    You can start with a quieter beginner-friendly view or keep the fuller wallet with more tools and settings visible from the start.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "simple" as const,
                      title: "Clean and simple mode",
                      description:
                        "A quieter wallet focused on balance, buying more, and the everyday actions most people need first.",
                    },
                    {
                      id: "advanced" as const,
                      title: "Advanced mode",
                      description:
                        "The full wallet with history, richer settings, routing options, and the broader dashboard surfaces visible.",
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        walletChoiceCardClass,
                        experienceModeChoice === option.id
                          ? "border-teal-500/70 bg-teal-50 text-slate-950 shadow-[0_20px_44px_rgba(8,145,178,0.16)] dark:bg-teal-500/10 dark:text-white"
                          : ""
                      )}
                      onClick={() => setExperienceModeChoice(option.id)}
                    >
                      <div className="space-y-2">
                        <p className="text-base font-semibold">{option.title}</p>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(4)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => void saveExperienceModeStep()} disabled={saveSignupStep.isPending || !experienceModeChoice}>
                    {saveSignupStep.isPending ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {wizardStep === 6 ? (
              <div className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    This name will help you recognize and deactivate a specific device later if you ever need to remove its wallet access.
                  </p>
                  <p>
                    We will identify this device using the auto-collected details below together with any custom name you give it.
                  </p>
                </div>
                <div>
                  <label htmlFor="deviceLabel" className="block text-sm font-medium mb-1">
                    Device name (optional)
                  </label>
                  <input
                    id="deviceLabel"
                    value={deviceLabel}
                    onChange={(event) => setDeviceLabel(event.target.value)}
                    placeholder="e.g., Work laptop"
                    className="w-full rounded border border-gray-300 bg-white p-2 text-black"
                  />
                </div>
                <div className={`${walletPanelMutedClass} space-y-3 text-sm`}>
                  <p className={walletSectionLabelClass}>Auto-collected device details</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operating system</p>
                      <p className="font-medium text-foreground">{detectedDeviceDetails.platform}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Browser</p>
                      <p className="font-medium text-foreground">{detectedDeviceDetails.browser}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Detected label</p>
                      <p className="font-medium text-foreground">{detectedDeviceDetails.label}</p>
                    </div>
                  </div>
                </div>
                {!walletReady ? (
                  <WalletComponent
                    type="evm"
                    user_id={cubidRuntimeUserId}
                    dapp_id="59"
                    api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                    onEVMWallet={async (walletArray: any) => {
                      const [walletDetails] = walletArray;
                      if (walletDetails) {
                        await insertOrUpdateDataInWallet(userData?.cubidData?.id, {
                          public_key: walletDetails.address,
                          is_generated: walletDetails?.is_generated_via_lib,
                          namespace: "EVM",
                        });
                      }
                    }}
                    onUserShare={async (usershare: any) => {
                      const serialisedShare = serialiseUserShare(usershare);
                      const deviceInfo = getDeviceMetadata(deviceLabel.trim() || undefined);
                      if (serialisedShare.credentialId) {
                        window.localStorage.setItem("tcoin_wallet_activeWalletCredentialId", serialisedShare.credentialId);
                      }

                      await registerWalletCustody({
                        namespace: "EVM",
                        userShareEncrypted: serialisedShare.userShareEncrypted,
                        credentialId: serialisedShare.credentialId,
                        deviceInfo,
                      });

                      setWalletReadyLocal(true);
                      await refetch();
                    }}
                    onAppShare={async (share) => {
                      if (share) {
                        await insertOrUpdateDataInWallet(userData?.cubidData?.id, {
                          app_share: share,
                          namespace: "EVM",
                        });
                        setWalletReadyLocal(true);
                        await refetch();
                      }
                    }}
                  />
                ) : null}
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(5)}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    {canSkipWalletSetup ? (
                      <Button type="button" variant="outline" onClick={() => void saveWalletStep(true)} disabled={saveSignupStep.isPending}>
                        {saveSignupStep.isPending ? "Skipping..." : "Skip"}
                      </Button>
                    ) : null}
                    <Button type="button" onClick={() => void saveWalletStep()} disabled={saveSignupStep.isPending || !walletReady}>
                      {saveSignupStep.isPending ? "Saving..." : "Continue"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {wizardStep === 7 ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">You’re all set</h2>
                  <p className="text-sm text-muted-foreground">Review the funding video below, then continue to your dashboard.</p>
                </div>
                {TCOIN_WELCOME_VIDEO_URL ? (
                  <video src={TCOIN_WELCOME_VIDEO_URL} controls className="w-full rounded" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Set `NEXT_PUBLIC_TCOIN_WELCOME_VIDEO_URL` to display the onboarding funding video.
                  </p>
                )}
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(6)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => void finishSignup()} disabled={completeSignup.isPending}>
                    {completeSignup.isPending ? "Finishing..." : "Continue to Dashboard"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          {wizardStep === 1 ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWizard(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveWelcomeStep()} disabled={saveSignupStep.isPending}>
                {saveSignupStep.isPending ? "Saving..." : "Continue"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
