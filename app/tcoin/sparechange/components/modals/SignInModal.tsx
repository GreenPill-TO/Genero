import { useSendPasscodeMutation, useVerifyPasscodeMutation } from "@shared/api/mutations/usePasscode";
import ImageCarousel from "@shared/components/ui/ImageCarousel";
import OTPForm from "@tcoin/sparechange/components/forms/OTPForm";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { createCubidUser } from "@shared/api/services/cubidService";
import { createNewUser, fetchUserByContact } from "@shared/api/services/supabaseService";

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
};

function SignInModal({ closeModal }: SignInModalProps) {
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [contact, setContact] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isPasscodeSent, setIsPasscodeSent] = useState(false);
  const router = useRouter();

  const fullContact = useMemo(() => {
    return authMethod === "phone" ? `${countryCode}${contact}` : contact;
  }, [authMethod, contact, countryCode]);

  const sendCodeMut = useSendPasscodeMutation({
    onSuccessCallback: () => {
      toast.success("Passcode sent successfully!");
      setIsPasscodeSent(true);
    },
    onErrorCallback: (err) => {
      toast.error(err.message);
    },
  });

  const verifyCodeMut = useVerifyPasscodeMutation({
    onSuccessCallback: async (result) => {
      toast.success("Passcode verified successfully!");
      await handlePostAuthentication(fullContact);
      closeModal();
    },
    onErrorCallback: (err) => {
      toast.error(err.message);
    },
  });

  const handleSendPasscode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      sendCodeMut.mutate({ contact, method: authMethod });
    },
    [fullContact, authMethod, contact]
  );

  const handleVerifyPasscode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      verifyCodeMut.mutate({ contact, method: authMethod, passcode });
    },
    [authMethod, contact, passcode]
  );

  const handlePostAuthentication = async (fullContact: string) => {
    const { user, error } = await fetchUserByContact(authMethod, fullContact);

    if (error || !user) {
      const uuid = await createCubidUser(fullContact, authMethod);
      const { error: insertError } = await createNewUser(authMethod, fullContact, uuid);
      if (insertError) return;

      setTimeout(() => {
        closeModal();
        router.push("/welcome");
      }, 2000);
    } else {
      setTimeout(() => {
        closeModal();
        if (user.has_completed_intro) router.push("/dashboard");
        else router.push("/welcome");
      }, 2000);
    }
  };

  const handleAuthMethodChange = (method: "phone" | "email") => {
    setAuthMethod(method);
    setContact("");
    setIsPasscodeSent(false);
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
            setCountryCode={setCountryCode}
            setContact={setContact}
            setPasscode={setPasscode}
            onSubmit={isPasscodeSent ? handleVerifyPasscode : handleSendPasscode}
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
