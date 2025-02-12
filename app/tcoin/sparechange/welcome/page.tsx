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
import { CubidWidget } from "cubid-sdk";
import { WalletComponent } from "cubid-wallet";

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
const initialFormData = {
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
  good_tip: 0,
  default_tip: 0,
  persona: null,
  current_step: 1,
  updated_at: new Date().toUTCString(),
};

const WelcomeFlow: React.FC = () => {
  const router = useRouter();
  const { userData } = useAuth();

  const [userFormData, setUserFormData] = useState<TCubidData>(
    userData?.cubidData?.current_step && userData?.cubidData?.current_step > 1
      ? { ...initialFormData, ...userData?.cubidData }
      : initialFormData
  );

  const [isNextEnabled, setIsNextEnabled] = useState<boolean>(true);

  const mainClass = cn("flex-grow flex flex-col items-center justify-center overflow-auto");

  const saveToLocalStorage = () => {
    localStorage.setItem("welcomeFlowData", JSON.stringify(userFormData));
  };

  const syncToSupabase = async (isCompleted?: boolean) => {
    const cubidId = userData?.user?.cubid_id;

    const userDataUpdate: { [key: string]: any } = {
      ...userFormData,
      preferred_donation_amount: userFormData.preferred_donation_amount,
      // profile_image_url: userFormData.profile_image_url ? URL.createObjectURL(userFormData.profile_image_url) : null,
      has_completed_intro: isCompleted ? true : undefined,
    };

    if (Object.keys(userDataUpdate).length > 0) {
      const { error } = await updateCubidDataInSupabase(cubidId, userDataUpdate);

      if (error) {
        console.error("Error syncing user data to Supabase:", error.message);
      }
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

  console.log({ userData: userData })

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
                onEVMWallet={(wallet) => {
                  console.log({ wallet })
                  if (wallet.length) {
                    nextStep()
                  }
                }}
                onAppShare={async (share) => {
                  console.log({ share })
                  if (share) {
                    await supabase.from("wallet_appshare").insert({
                      app_share: share,
                      user_id: (userData?.cubidData as any)?.id
                    })
                  }
                }} />
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
          {userFormData.current_step > 1 && userFormData.current_step < 6 && (
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
