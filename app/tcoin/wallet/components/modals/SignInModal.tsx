"use client";
// @ts-nocheck
import { useSendPasscodeMutation, useVerifyPasscodeMutation } from "@shared/api/mutations/usePasscode";
import ImageCarousel from "@shared/components/ui/ImageCarousel";
import OTPForm from "@tcoin/wallet/components/forms/OTPForm";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { toast } from "react-toastify";
import type { Session } from "@supabase/supabase-js";

import { fetchUserByContact, waitForAuthenticatedSession } from "@shared/api/services/supabaseService";

const constants = {
  SIGN_UP_IMAGES: [
    {
      title: "Support with spare change.",
      imageUrl:
        "https://plus.unsplash.com/premium_photo-1677105212168-8b5704a404d9?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Join our community.",
      imageUrl: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1350&q=80",
    },
    {
      title: "Make a difference today.",
      imageUrl:
        "https://images.unsplash.com/photo-1547481887-a26e2cacb5b2?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Empower those in need.",
      imageUrl:
        "https://plus.unsplash.com/premium_photo-1692110540280-88aa6dd9c3db?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      title: "Be a change maker.",
      imageUrl: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1350&q=80",
    },
  ],
};

type SignInModalProps = {
  closeModal: () => void;
  extraObject: {
    isSignIn: boolean;
  };
  postAuthRedirect?: string | null;
};

function SignInModal({ closeModal, postAuthRedirect }: SignInModalProps) {
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("email");
  const [countryCode, setCountryCode] = useState("+1");
  const [contact, setContact] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isPasscodeSent, setIsPasscodeSent] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const router = useRouter();

  useEscapeKey(closeModal);

  const fullContact = useMemo(() => {
    return authMethod === "phone" ? `${countryCode}${contact}` : contact;
  }, [authMethod, contact, countryCode]);

  const sendCodeMut = useSendPasscodeMutation({
    onSuccessCallback: () => {
      toast.success("Passcode sent successfully!");
      setIsPasscodeSent(true);
      setOtpResetKey((current) => current + 1);
    },
    onErrorCallback: (err) => {
      toast.error(err.message);
    },
  });

  const verifyCodeMut = useVerifyPasscodeMutation({
    onSuccessCallback: async (verifiedSession?: Session | null) => {
      toast.success("Passcode verified successfully!");
      const destination =
        postAuthRedirect ?? (await handlePostAuthentication(fullContact, verifiedSession ?? null));
      if (!destination) return;
      closeModal();
      router.push(destination);
    },
    onErrorCallback: (err) => {
      setPasscode("");
      setOtpResetKey((current) => current + 1);
      toast.error(err.message);
    },
  });

  const handleSendPasscode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      sendCodeMut.mutate({ contact: fullContact, method: authMethod });
    },
    [authMethod, fullContact, sendCodeMut]
  );

  const handleVerifyPasscode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      verifyCodeMut.mutate({ contact: fullContact, method: authMethod, passcode });
    },
    [authMethod, fullContact, passcode, verifyCodeMut]
  );

  const handlePostAuthentication = async (
    fullContact: string,
    verifiedSession?: Session | null
  ): Promise<string | null> => {
    const session =
      verifiedSession?.access_token ? verifiedSession : await waitForAuthenticatedSession({ timeoutMs: 10000 });
    if (!session?.access_token) {
      toast.error("We couldn't finish signing you in. Please try again.");
      return null;
    }

    const { user, error } = await fetchUserByContact(authMethod, fullContact);

    if (error || !user) {
      console.error("Failed to finish authenticated user provisioning:", error);
      toast.error("We couldn't finish signing you in. Please try again.");
      return null;
    }

    return user.has_completed_intro ? "/dashboard" : "/welcome";
  };

  const handleAuthMethodChange = (method: "phone" | "email") => {
    setAuthMethod(method);
    setContact("");
    setPasscode("");
    setIsPasscodeSent(false);
    setOtpResetKey(0);
  };

  return (
    <div className="flex items-center rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <ImageCarousel images={constants.SIGN_UP_IMAGES} />
        <div className="md:p-10 pb-12">
          <OTPForm
            authMethod={authMethod}
            countryCode={countryCode}
            contact={contact}
            passcode={passcode}
            otpResetKey={otpResetKey}
            setCountryCode={setCountryCode}
            setContact={setContact}
            setPasscode={setPasscode}
            onSubmit={isPasscodeSent ? handleVerifyPasscode : handleSendPasscode}
            canResend={true}
            onResend={() => {
              setPasscode("");
              sendCodeMut.mutate({ contact: fullContact, method: authMethod });
            }}
            isOtpSent={isPasscodeSent}
            errorMessage={null}
            handleAuthMethodChange={handleAuthMethodChange}
            isLoading={sendCodeMut.isPending || verifyCodeMut.isPending}
          />
        </div>
      </div>
    </div>
  );
}

export default SignInModal;
