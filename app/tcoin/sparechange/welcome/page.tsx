// @ts-nocheck
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@shared/lib/supabase/client";

// Import all the step components
import { useAuth } from "@shared/api/hooks/useAuth";
import { updateCubidDataInSupabase } from "@shared/api/services/supabaseService";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@shared/components/ui/Card";
import { TCubidData } from "@shared/types/cubid";
import { cn } from "@shared/utils/classnames";
import {
  AddFundsStep,
  DonationPreferencesStep,
  FinalWelcomeStep,
  OnboardingIntroStep,
  PersonaSelectionStep,
  PublicProfileCreationStep,
  ReceiveDonationsStep,
  StorePaymentsStep,
  StoreProfileStep,
  UserInfoStep,
} from "@tcoin/sparechange/welcome/steps";
import dynamic from "next/dynamic";
import useDarkMode from "@shared/hooks/useDarkMode";
const WalletComponent = dynamic(
  () => import('cubid-wallet').then((mod) => mod.WalletComponent),
  { ssr: false }
);
const CubidWidget = dynamic(
  () => import('cubid-sdk').then((mod) => mod.CubidWidget),
  { ssr: false }
);

const supabase = createClient();

const stepHeadings = [
  "Introduction",
  "Complete Your Profile",
  "Choose Your Persona",
  "Additional Details",
  "Finalize Setup",
  "Add Cubid Stamp",
  "Add Cubid Wallet",
  "You're All Set!",
];

type WelcomeFormState = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  bio: string;
  profile_image_url: File | string | null;
  preferred_donation_amount: number | null;
  selected_cause: string;
  good_tip: number | null;
  default_tip: number | null;
  persona: string | null;
  current_step: number;
  charity: string;
  updated_at: string;
};

const createDefaultFormState = (): WelcomeFormState => ({
  full_name: "",
  username: "",
  email: "",
  phone: "",
  address: "",
  category: "Restaurant",
  bio: "",
  profile_image_url: null,
  preferred_donation_amount: 0,
  selected_cause: "",
  good_tip: null,
  default_tip: null,
  persona: null,
  current_step: 1,
  charity: "",
  updated_at: new Date().toISOString(),
});

const deriveFormStateFromCubid = (cubidData?: TCubidData | null): WelcomeFormState => {
  const base = createDefaultFormState();
  if (!cubidData) {
    return base;
  }

  const profile = cubidData.activeProfile;

  return {
    ...base,
    full_name: cubidData.full_name ?? base.full_name,
    username: cubidData.username ?? base.username,
    email: cubidData.email ?? base.email,
    phone: cubidData.phone ?? base.phone,
    address: cubidData.address ?? base.address,
    bio: cubidData.bio ?? base.bio,
    profile_image_url: cubidData.profile_image_url ?? base.profile_image_url,
    persona: profile?.persona ?? base.persona,
    preferred_donation_amount:
      profile?.tippingPreferences.preferredDonationAmount ?? base.preferred_donation_amount,
    good_tip: profile?.tippingPreferences.goodTip ?? base.good_tip,
    default_tip: profile?.tippingPreferences.defaultTip ?? base.default_tip,
    selected_cause: profile?.charityPreferences.selectedCause ?? base.selected_cause,
    charity: profile?.charityPreferences.charity ?? base.charity,
    current_step: profile?.onboardingState.currentStep ?? base.current_step,
    category: profile?.onboardingState.category ?? base.category,
    updated_at: cubidData.updated_at ?? base.updated_at,
  };
};

const normaliseNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const WelcomeFlow: React.FC = () => {
  const router = useRouter();
  const { userData } = useAuth();
  const { isDarkMode } = useDarkMode();

  const initialState = deriveFormStateFromCubid(userData?.cubidData);
  const [userFormData, setUserFormData] = useState<WelcomeFormState>(
    initialState.current_step && initialState.current_step > 1
      ? initialState
      : { ...createDefaultFormState(), ...initialState }
  );

  const [isNextEnabled, setIsNextEnabled] = useState<boolean>(true);

  const mainClass = cn("flex-grow flex flex-col items-center justify-center overflow-auto");

  const saveToLocalStorage = () => {
    localStorage.setItem("welcomeFlowData", JSON.stringify(userFormData));
  };

  const syncToSupabase = async (isCompleted?: boolean) => {
    const cubidId = userData?.user?.cubid_id;
    if (!cubidId) {
      return;
    }

    const updatedAtIso = new Date().toISOString();
    const userUpdates: Record<string, unknown> = {
      full_name: userFormData.full_name,
      username: userFormData.username,
      email: userFormData.email,
      phone: userFormData.phone,
      address: userFormData.address,
      bio: userFormData.bio,
      updated_at: updatedAtIso,
    };

    if (typeof userFormData.profile_image_url === "string" || userFormData.profile_image_url === null) {
      userUpdates.profile_image_url = userFormData.profile_image_url;
    }

    if (isCompleted) {
      userUpdates.has_completed_intro = true;
    }

    const profileUpdates = {
      persona: userFormData.persona,
      tippingPreferences: {
        preferredDonationAmount: normaliseNullableNumber(userFormData.preferred_donation_amount),
        goodTip: normaliseNullableNumber(userFormData.good_tip),
        defaultTip: normaliseNullableNumber(userFormData.default_tip),
      },
      charityPreferences: {
        selectedCause: userFormData.selected_cause,
        charity:
          userFormData.charity ||
          userData?.cubidData?.activeProfile?.charityPreferences?.charity ||
          userData?.cubidData?.activeProfile?.charityPreferences?.selectedCause ||
          null,
      },
      onboardingState: {
        currentStep: userFormData.current_step,
        category: userFormData.category,
      },
    };

    const { error } = await updateCubidDataInSupabase(cubidId, {
      user: userUpdates,
      profile: profileUpdates,
    });

    if (error) {
      console.error("Error syncing user data to Supabase:", error.message ?? error);
    }
  };

  const nextStep = useCallback(() => {
    saveToLocalStorage();
    syncToSupabase();
    setUserFormData({ ...userFormData, current_step: userFormData.current_step + 1 });
  }, [userFormData]);

  const previousStep = useCallback(() => {
    setUserFormData({ ...userFormData, current_step: userFormData.current_step - 1 });
  }, [userFormData]);

  const handlePersonaSelection = useCallback(
    (selectedPersona: string) => {
      setUserFormData({ ...userFormData, persona: selectedPersona });
      setIsNextEnabled(true); // Enable the Continue button after persona selection
    },
    [userFormData]
  );

  const updateUserFormField = useCallback(
    (key: string, value: any) => {
      setUserFormData({ ...userFormData, [key]: value });
    },
    [userFormData]
  );

  useEffect(() => {
    if (userFormData.current_step === 1) {
      setIsNextEnabled(true); // Always enable Next button on the first step
    }
  }, [userFormData.current_step]);

  useEffect(() => {
    if (!userData?.cubidData) {
      return;
    }
    const derivedState = deriveFormStateFromCubid(userData.cubidData);
    if (derivedState.current_step > userFormData.current_step) {
      setUserFormData(derivedState);
    }
  }, [userData?.cubidData, userFormData.current_step]);

  const upsertWalletKey = async (userId: number, payload: Record<string, unknown> = {}) => {
    const namespace = (payload.namespace as string) || "EVM";
    const { data: keyData, error } = await supabase
      .from("wallet_keys")
      .upsert(
        {
          user_id: userId,
          namespace,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,namespace" }
      )
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return keyData.id as number;
  }

  const insertOrUpdateDataInWallet = async (userId: number, add: Record<string, unknown>) => {
    const walletKeyId =
      (add.wallet_key_id as number | undefined) ??
      (await upsertWalletKey(userId, {
        namespace: (add.namespace as string) || "EVM",
        ...(typeof add.app_share === "string" ? { app_share: add.app_share } : {}),
      }));

    const walletPayload: Record<string, unknown> = {
      ...add,
      wallet_key_id: walletKeyId,
    };
    delete walletPayload.app_share;

    const { data } = await supabase
      .from("wallet_list")
      .select("id")
      .match({ user_id: userId, namespace: (walletPayload.namespace as string) || "EVM" })
      .limit(1);

    if (data?.[0]) {
      await supabase
        .from("wallet_list")
        .update(walletPayload)
        .match({ id: data[0].id })
    } else {
      await supabase.from("wallet_list").insert({
        user_id: userId,
        namespace: (walletPayload.namespace as string) || "EVM",
        ...walletPayload,
      })
    }

    return walletKeyId;
  }


  return (
    <div className={mainClass}>
      <Card>
        <CardHeader className="text-2xl font-semibold text-center mb-8">
          <div className="flex justify-center mb-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full mx-1 ${index + 1 === userFormData.current_step ? "bg-indigo-600" : "dark:bg-gray-600 bg-gray-300"
                  }`}
              ></div>
            ))}
          </div>
          {stepHeadings[userFormData.current_step - 1]}
        </CardHeader>

        <CardContent>
          {/* <TransitionGroup> */}
          {/* <CSSTransition key={userFormData.current_step} classNames="slide" timeout={300}> */}
          <div className="step-content">
            {userFormData.current_step === 1 && <OnboardingIntroStep nextStep={nextStep} />}
            {userFormData.current_step === 2 && (
              <UserInfoStep
                fullName={userFormData.full_name}
                username={userFormData.username}
                email={userFormData.email}
                phoneNumber={userFormData.phone}
                setFullName={(v) => updateUserFormField("full_name", v)}
                setUserName={(v) => updateUserFormField("username", v)}
                setEmail={(v) => updateUserFormField("email", v)}
                setPhoneNumber={(v) => updateUserFormField("phone", v)}
                setIsNextEnabled={setIsNextEnabled}
              />
            )}
            {userFormData.current_step === 3 && (
              <PersonaSelectionStep
                persona={userFormData.persona}
                handlePersonaSelection={handlePersonaSelection}
                setIsNextEnabled={setIsNextEnabled}
              />
            )}
            {userFormData.current_step === 4 && userFormData.persona && (
              <>
                {(userFormData.persona === "ph" || userFormData.persona === "tip") && (
                  <PublicProfileCreationStep
                    bio={userFormData.bio}
                    address={userFormData.address}
                    profileImage={userFormData.profile_image_url}
                    setBio={(v) => updateUserFormField("bio", v)}
                    setAddress={(v) => updateUserFormField("address", v)}
                    handleImageUpload={(v) => updateUserFormField("profile_image_url", v)}
                    setIsNextEnabled={setIsNextEnabled}
                    nextStep={nextStep}
                  />
                )}
                {userFormData.persona === "sm" && (
                  <StorePaymentsStep nextStep={nextStep} setIsNextEnabled={setIsNextEnabled} />
                )}
                {userFormData.persona === "dr" && (
                  <DonationPreferencesStep
                    preferredDonationAmount={userFormData.preferred_donation_amount || 0}
                    selectedCause={userFormData.selected_cause}
                    goodTip={userFormData.good_tip}
                    defaultTip={userFormData.default_tip}
                    setPreferredDonationAmount={(v) => updateUserFormField("preferred_donation_amount", v)}
                    setSelectedCause={(v) => updateUserFormField("selected_cause", v)}
                    setGoodTip={(v) => updateUserFormField("good_tip", v)}
                    setDefaultTip={(v) => updateUserFormField("default_tip", v)}
                    setIsNextEnabled={setIsNextEnabled}
                    nextStep={nextStep}
                  />
                )}
              </>
            )}
            {userFormData.current_step === 5 && userFormData.persona && (
              <>
                {(userFormData.persona === "ph" || userFormData.persona === "tip") && (
                  <ReceiveDonationsStep nextStep={nextStep} setIsNextEnabled={setIsNextEnabled} />
                )}
                {userFormData.persona === "sm" && (
                  <StoreProfileStep
                    fullName={userFormData.full_name}
                    phoneNumber={userFormData.phone}
                    address={userFormData.address}
                    category={userFormData.category}
                    setCategory={(v) => updateUserFormField("category", v)}
                    setFullName={(v) => updateUserFormField("full_name", v)}
                    setPhoneNumber={(v) => updateUserFormField("phone", v)}
                    setAddress={(v) => updateUserFormField("address", v)}
                    nextStep={nextStep}
                    setIsNextEnabled={setIsNextEnabled}
                  />
                )}
                {userFormData.persona === "dr" && (
                  <AddFundsStep
                    preferredDonationAmount={userFormData.preferred_donation_amount || 0}
                    setPreferredDonationAmount={(v) => updateUserFormField("preferred_donation_amount", v)}
                    handleSubmitPayment={() => { }}
                    nextStep={nextStep}
                    setIsNextEnabled={setIsNextEnabled}
                  />
                )}
              </>
            )}
            {userFormData.current_step === 6 && (
              <>
                <CubidWidget stampToRender="phone" uuid={userData?.user?.cubid_id}
                  page_id="37" api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                  onStampChange={() => {
                    nextStep()
                  }}
                />
                <CubidWidget stampToRender="email" uuid={userData?.user?.cubid_id}
                  page_id="37" api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                />
              </>
            )}
            {userFormData.current_step === 7 && (
              <WalletComponent type="evm" user_id={userData?.user?.cubid_id} dapp_id="59"
                api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                onEVMWallet={async (wallet: any) => {
                  const [walletDetails] = wallet;
                  if (wallet.length) {
                    await insertOrUpdateDataInWallet(userData?.cubidData?.id, {
                      public_key: walletDetails.address,
                      is_generated: walletDetails?.is_generated_via_lib,
                      namespace: "EVM",
                    })
                    nextStep()
                  }
                }}
                onUserShare={async (usershare: any) => {
                  function bufferToBase64(buf) {
                    return Buffer.from(buf).toString('base64');
                  }
                  const jsonData = {
                    encryptedAesKey
                      : bufferToBase64(usershare.encryptedAesKey),
                    encryptedData: bufferToBase64(usershare.encryptedData),
                    encryptionMethod: usershare.encryptionMethod,
                    id: usershare.id,
                    iv: bufferToBase64(usershare.iv),
                    ivForKeyEncryption: usershare.ivForKeyEncryption,
                    salt: usershare.salt,
                    credentialId: bufferToBase64(usershare.credentialId)
                  };
                  const walletKeyId = await upsertWalletKey(userData?.cubidData?.id, {
                    namespace: "EVM",
                  });
                  await supabase.from("user_encrypted_share").insert({
                    user_share_encrypted: jsonData,
                    user_id: userData?.cubidData?.id,
                    wallet_key_id: walletKeyId,
                  })
                }}
                onAppShare={async (share: any) => {
                  if (share) {
                    await insertOrUpdateDataInWallet((userData?.cubidData as any)?.id, {
                      app_share: share,
                      namespace: "EVM",
                    })
                  }
                }}
              />
            )}
            {userFormData.current_step === 8 && (
              <FinalWelcomeStep
                onDashboardRedirect={() => {
                  saveToLocalStorage();
                  syncToSupabase(true);
                  router.push("/dashboard");
                }}
              />
            )}
          </div>
          {/* </CSSTransition> */}
          {/* </TransitionGroup> */}
        </CardContent>

        <CardFooter>
          {userFormData.current_step > 1 && userFormData.current_step < 9 && (
            <Button onClick={previousStep}>Back</Button>
          )}
          {userFormData.current_step < 8 && (
            <Button onClick={nextStep} disabled={!isNextEnabled} style={{ marginLeft: "auto" }}>
              Continue
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default WelcomeFlow;
