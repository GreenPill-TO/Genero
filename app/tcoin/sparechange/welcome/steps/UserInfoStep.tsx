import { useAuth } from "@shared/api/hooks/useAuth";
import InputField from "@shared/components/ui/InputField";
import React, { useEffect, useMemo } from "react";

interface UserInfoStepProps {
  fullName: string;
  username: string;
  phoneNumber: string;
  email: string;
  setFullName: (value: string) => void;
  setUserName: (value: string) => void;
  setPhoneNumber: (value: string) => void;
  setEmail: (value: string) => void;
  setIsNextEnabled: (enabled: boolean) => void;
}

export const UserInfoStep: React.FC<UserInfoStepProps> = ({
  fullName,
  username,
  phoneNumber,
  email,
  setFullName,
  setUserName,
  setPhoneNumber,
  setEmail,
  setIsNextEnabled,
}) => {
  const { userData, authData } = useAuth();

  const authMethod = useMemo(() => {
    return authData?.user?.app_metadata?.provider;
  }, [authData]);

  useEffect(() => {
    // Determine if user authenticated with email or phone

    if (authMethod === "email") {
      setEmail(authData?.user?.email || "");
    } else if (authMethod === "phone") {
      setPhoneNumber(authData?.user?.phone || "");
    }
  }, [authMethod, authData?.user]);

  useEffect(() => {
    if (userData?.cubidData?.full_name) {
      setFullName(userData?.cubidData?.full_name);
    }
    if (userData?.cubidData?.username) {
      setUserName(userData?.cubidData?.full_name);
    }
  }, [userData?.cubidData]);

  useEffect(() => {
    // Enable the "Next" button only if fullName and either phoneNumber or email are not empty
    const isComplete =
      fullName.trim() !== "" &&
      username.trim() !== "" &&
      ((authMethod === "email" && email.trim() !== "") || (authMethod === "phone" && phoneNumber.trim() !== ""));

    setIsNextEnabled(isComplete);
  }, [authMethod, email, phoneNumber, fullName, username]);
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  return (
    <div className="user-info-step">
      <h2 className="text-2xl font-bold mb-4">Complete Your Profile</h2>
      <p className="mb-4">
        Your full name will only be visible to users who have mutually connected with you. Your username will be publicly visible to all users.
      </p>
      <InputField label="Full Name: " name="fullName" value={fullName} onChange={handleFullNameChange} />
      <InputField label="Username: " name="username" value={username} onChange={handleUserNameChange} />
      {authMethod === "phone" ? (
        <InputField label="Phone Number: " name="phoneNumber" value={phoneNumber} onChange={handlePhoneNumberChange} />
      ) : (
        <InputField label="Email: " name="email" value={email} onChange={handleEmailChange} />
      )}
    </div>
  );
};
