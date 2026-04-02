// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  walletPageClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";

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
  const [wizardStep, setWizardStep] = useState(1);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [walletReadyLocal, setWalletReadyLocal] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [profilePictureSelection, setProfilePictureSelection] = useState<PreparedProfilePicture | null>(null);
  const [profilePictureCrop, setProfilePictureCrop] = useState<ProfilePictureCropState>(DEFAULT_CROP_STATE);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isPreparingProfilePicture, setIsPreparingProfilePicture] = useState(false);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettingsForm>({
    charity: "",
    selectedCause: "",
    primaryBiaId: "",
    secondaryBiaIds: [],
  });
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const totalSteps = 6;
  const canSkipWalletSetup = ["development", "local"].includes(
    (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase()
  );
  const usernameValueFromBootstrap = bootstrap?.user.username ?? "";
  const currentStep = bootstrap?.signup.currentStep ?? wizardStep;
  const walletReady = bootstrap?.signup.walletReady === true || walletReadyLocal;

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
      country: null,
    },
  });

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
      router.replace("/dashboard");
    }
  }, [bootstrap?.signup.state, router]);

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
      country: shouldPrepopulateDetails ? getInitialCountryOption(bootstrap.user.country, countryOptions) : null,
    });
    setWizardStep(bootstrap.signup.currentStep ?? 1);
    setPhoneVerified(bootstrap.signup.phoneVerified);
    setCommunitySettings({
      charity: bootstrap.preferences.charity ?? "",
      selectedCause: bootstrap.preferences.selectedCause ?? bootstrap.preferences.charity ?? "",
      primaryBiaId: bootstrap.preferences.primaryBiaId ?? "",
      secondaryBiaIds: bootstrap.preferences.secondaryBiaIds ?? [],
    });
  }, [bootstrap, countryOptions, reset]);

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
      if (profilePictureSelection?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePictureSelection.previewUrl);
      }
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
      setShowWizard(true);
      setWizardStep(next.signup.currentStep ?? 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start signup.");
    }
  };

  const handleReset = async () => {
    try {
      const next = await resetSignup.mutateAsync();
      if (profilePictureSelection?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePictureSelection.previewUrl);
      }
      setProfilePictureSelection(null);
      setProfilePictureCrop(DEFAULT_CROP_STATE);
      setProfilePicturePreview(null);
      setShowWizard(true);
      setWizardStep(next.signup.currentStep ?? 1);
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
      const next = await saveSignupStep.mutateAsync({
        step: 4,
        payload: {
          charity: communitySettings.charity,
          selectedCause: communitySettings.selectedCause || communitySettings.charity,
          primaryBiaId: communitySettings.primaryBiaId,
          secondaryBiaIds: communitySettings.secondaryBiaIds.filter((biaId) => biaId !== communitySettings.primaryBiaId),
        },
      });
      goToNextStep(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save community settings.");
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
        step: 5,
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
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete signup.");
    }
  };

  const mainClass = cn(
    walletPageClass,
    "min-h-screen justify-center font-sans lg:pl-40 xl:pl-44"
  );
  const selectedPrimaryBiaId = communitySettings.primaryBiaId;

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
            if (options?.revokeOnCancel && selection.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(selection.previewUrl);
            }
            closeModal();
          }}
          onApply={(nextCrop) => {
            if (
              profilePictureSelection?.previewUrl &&
              profilePictureSelection.previewUrl !== selection.previewUrl &&
              profilePictureSelection.previewUrl.startsWith("blob:")
            ) {
              URL.revokeObjectURL(profilePictureSelection.previewUrl);
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
    if (profilePictureSelection?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(profilePictureSelection.previewUrl);
    }
    setProfilePictureSelection(null);
    setProfilePictureCrop(DEFAULT_CROP_STATE);
    setProfilePicturePreview(source || null);
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
      {!showWizard && bootstrap.signup.state === "none" ? (
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
            <p>TCOIN is pegged to local transit value so the currency stays intuitive in daily use and easier to relate to than a speculative token price.</p>
            <p>You will be asked which charity you support, and from then on a small percentage of your TCOIN activity will keep contributing to that charity.</p>
            <p>Fun fact: when the TTC sold its first ticket, it cost 6 cents. If you could have held on to that price, you would have made more than 5,000% by now.</p>
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
                <p>This step is about the signup process itself: we will set up your profile, community defaults, and wallet access together so the app is ready to use when you land in the dashboard.</p>
                <p>You will add your user details, choose a profile picture, choose your charity and neighbourhood preferences, and then connect your wallet.</p>
                <p>Your progress is saved step by step, so if you leave part-way through you can come back and resume from where you stopped.</p>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <form className="space-y-4" onSubmit={handleSubmit(saveUserDetailsStep)}>
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                  <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`}>
                    <div className="space-y-1">
                      <p className={walletSectionLabelClass}>Required to continue</p>
                      <p className="text-sm text-muted-foreground">First name, last name, and phone verification are required.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                          First name
                        </label>
                        <input
                          id="firstName"
                          placeholder="Mats"
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
                          placeholder="Sundin"
                          className={nativeFieldClass}
                          {...register("lastName", { required: "Last name is required" })}
                        />
                        {errors.lastName ? <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-black dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                      <p className="mb-2 text-sm font-medium">Phone verification</p>
                      {phoneVerified ? (
                        <p className="text-sm text-green-600">Phone verified. You are good to continue.</p>
                      ) : (
                        <>
                          <CubidWidget
                            stampToRender="phone"
                            uuid={userData?.user?.cubid_id}
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
                      <p className="text-sm text-muted-foreground">Preferred name, username, and country can be added now or later.</p>
                    </div>
                    <div>
                      <label htmlFor="nickname" className="block text-sm font-medium mb-1">
                        Preferred name
                      </label>
                      <input
                        id="nickname"
                        placeholder="Mats"
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
                        placeholder="mats.sundin"
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
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium mb-1">
                        Country
                      </label>
                      <Controller
                        control={control}
                        name="country"
                        render={({ field }) => (
                          <Select
                            {...field}
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
                      !watch("firstName") ||
                      !watch("lastName")
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
                    <Avatar className="h-24 w-24">
                      {profilePicturePreview ? (
                        <AvatarImage src={profilePicturePreview} alt="Profile picture preview" />
                      ) : (
                        <AvatarFallback>
                          <LuUser />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  )}
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Add a profile picture now, or continue and come back to it later from Edit Profile.
                    </p>
                    <label htmlFor="signupProfilePicture" className="block text-sm font-medium">
                      Choose a profile picture
                    </label>
                    <input
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
                    disabled={saveSignupStep.isPending || !communitySettings.charity || !communitySettings.primaryBiaId}
                  >
                    {saveSignupStep.isPending ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="space-y-4">
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
                {walletReady ? (
                  <p className="text-sm text-green-600">Wallet already configured for this app. You can continue.</p>
                ) : (
                  <WalletComponent
                    type="evm"
                    user_id={userData?.user?.cubid_id}
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
                )}
                <div className="flex justify-between px-0">
                  <Button type="button" variant="outline" onClick={() => setWizardStep(4)}>
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

            {wizardStep === 6 ? (
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
                  <Button type="button" variant="outline" onClick={() => setWizardStep(5)}>
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
