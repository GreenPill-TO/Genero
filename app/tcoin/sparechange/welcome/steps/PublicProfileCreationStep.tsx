import ImageUpload from "@shared/components/ui/ImageUpload";
import InputField from "@shared/components/ui/InputField";
import React, { useEffect } from "react";

interface PublicProfileCreationStepProps {
  bio: string;
  address: string;
  profileImage: File | null;
  setBio: (value: string) => void;
  setAddress: (value: string) => void;
  handleImageUpload: (file: File | null) => void;
  setIsNextEnabled: (enabled: boolean) => void;
  nextStep: () => void;
}

export const PublicProfileCreationStep: React.FC<PublicProfileCreationStepProps> = ({
  bio,
  address,
  profileImage,
  setBio,
  setAddress,
  handleImageUpload,
  setIsNextEnabled,
}) => {
  useEffect(() => {
    // Enable the "Next" button if both bio and profile image are present
    const isComplete = bio.trim() !== "" && profileImage !== null;
    setIsNextEnabled(isComplete);
  }, [bio, profileImage, setIsNextEnabled]);

  return (
    <div className="public-profile-creation-step">
      <h2 className="text-2xl font-bold">Create Your Public Profile</h2>
      <ImageUpload label="Profile Picture" name="profilePicture" onImageUpload={handleImageUpload} />
      <InputField type="textarea" label="Bio or Introduction" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      <InputField label="Location (Optional)" name="location" value={address} onChange={(e) => setAddress(e.target.value)} />
    </div>
  );
};
