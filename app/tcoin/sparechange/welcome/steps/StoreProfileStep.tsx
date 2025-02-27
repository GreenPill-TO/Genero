// @ts-nocheck
import InputField from "@shared/components/ui/InputField";
import { Select } from "@shared/components/ui/Select";
import React, { useEffect } from "react";

interface StoreProfileStepProps {
  fullName: string;
  phoneNumber: string;
  address: string;
  category: string;
  setFullName: (value: string) => void;
  setPhoneNumber: (value: string) => void;
  setAddress: (value: string) => void;
  setCategory: (v: string) => void;
  setIsNextEnabled: (isEnabled: boolean) => void;
  nextStep: () => void;
}

export const StoreProfileStep: React.FC<StoreProfileStepProps> = ({
  fullName,
  phoneNumber,
  address,
  category,
  setFullName,
  setPhoneNumber,
  setAddress,
  setCategory,
  setIsNextEnabled,
}) => {
  useEffect(() => {
    // Enable the Continue button only if the required fields are filled out
    const isComplete = fullName.trim() !== "" && phoneNumber.trim() !== "";
    setIsNextEnabled(isComplete);
  }, [fullName, phoneNumber, setIsNextEnabled]);

  return (
    <div className={`p-6 space-y-6`}>
      <h2 className="text-2xl font-bold">Profile Your Store</h2>
      <InputField label="Store Name" name="storeName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Select
        variant="bordered"
        label="Category"
        name="category"
        value={category}
        onValueChange={(v) => setCategory(v)}
        options={[
          { label: "Restaurant", value: "restaurant" },
          { label: "Retail", value: "retail" },
          { label: "Service", value: "service" },
        ]}
      />
      <InputField label="Store Location" name="storeLocation" value={address} onChange={(e) => setAddress(e.target.value)} />
      <InputField label="Contact Information" name="contactInfo" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
      <InputField
        label="Max Tip/Donation Percentage"
        name="maxTip"
        value={fullName} // Replace with the appropriate state if this is a mistake
        onChange={(e) => setFullName(e.target.value)}
      />
    </div>
  );
};
