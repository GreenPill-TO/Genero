// @ts-nocheck
import { useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { createClient } from "@shared/lib/supabase/client";
import { useTheme } from "@shared/providers/theme-provider";

interface UserProfileModalProps {
  closeModal: () => void;
}

interface EditProfileContentProps {
  onCancel: () => void;
}

const EditProfileContent = ({ onCancel }: EditProfileContentProps) => {
  const { userData } = useAuth();
  const [displayName, setDisplayName] = useState(userData?.cubidData.full_name || "");
  const [profilePicture, setProfilePicture] = useState("https://github.com/shadcn.png");
  // Assume walletAccounts is an array of strings

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileUrl = URL.createObjectURL(e.target.files[0]);
      setProfilePicture(fileUrl);
    }
  };

  const handleSave = async () => {
    const supabase = createClient();

    let profileImageUrl = profilePicture; // Default to existing profile picture

    // Upload new profile picture if a file was selected
    if (profilePicture.startsWith("blob:")) {
      const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${userData?.cubidData?.id}.${fileExt}`;
        const filePath = `profile_pictures/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage.from("profile_pictures").upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          return;
        }

        // Get public URL
        const { data } = supabase.storage.from("profile_pictures").getPublicUrl(filePath);
        profileImageUrl = data.publicUrl;
      }
    }

    // Update user profile in the database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: displayName,
        profile_image_url: profileImageUrl,
      })
      .eq("id", userData?.cubidData?.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return;
    }

    console.log("Profile updated successfully");
    onCancel();
  };


  return (
    <>
      <>
        <p className="text-xl">Edit Profile</p>
      </>
      <div className="mb-4">
        <label className="block mb-1 font-medium">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border rounded text-black px-2 py-1 w-full"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-medium">Profile Picture</label>
        <div className="flex items-center space-x-4">
          <img className="w-16 h-16" src={profilePicture} alt="Profile" />
          <input type="file" accept="image/*" onChange={handleProfilePictureChange} />
        </div>
      </div>
      <>
        <Button onClick={handleSave} className="flex-1">
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </>
    </>
  );
};

interface ViewProfileContentProps {
  onEdit: () => void;
  closeModal: () => void;
}

const ViewProfileContent = ({ onEdit, closeModal }: ViewProfileContentProps) => {
  const { signOut, userData } = useAuth();
  const { theme, setTheme } = useTheme();

  const options = [
    { id: 0, label: "Light Gray" },
    { id: 1, label: "Dark Gray" },
    { id: 2, label: "Light Colour" },
    { id: 3, label: "Dark Colour" },
  ];

  console.log({ userData })

  return (
    <>
      <>
        <p className="text-xl">Profile</p>
      </>
      <div className="mb-4">
        <div className="flex items-center space-x-4 mb-4">
          <img className="w-20 h-20" src={userData?.cubidData?.profile_image_url || "https://github.com/shadcn.png"} alt="@shadcn" />
          <Button variant="link" className="p-0 h-auto" onClick={() => console.log("Change avatar")}>
            Change avatar
          </Button>
        </div>
        <p>
          <strong>Name:</strong> {userData?.cubidData.full_name}
        </p>
        <p>
          <strong>Email:</strong> {userData?.cubidData.email}
        </p>
      </div>
      <div className="mb-4">
        <p className="font-medium mb-2">Theme</p>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button
              key={o.id}
              variant={theme === o.id ? "default" : "outline"}
              onClick={() => setTheme(o.id)}
              className="px-2"
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
      <>
        <Button variant="default" onClick={onEdit} className="flex-1">
          Edit Profile
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            signOut();
            closeModal();
            localStorage.clear()
          }}
          className="flex-1"
        >
          Log Out
        </Button>
      </>
    </>
  );
};

const UserProfileModal = ({ closeModal }: UserProfileModalProps) => {
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <>
      <>
        {isEditMode ? (
          <EditProfileContent onCancel={() => setIsEditMode(false)} />
        ) : (
          <ViewProfileContent onEdit={() => setIsEditMode(true)} closeModal={closeModal} />
        )}
      </>
    </>
  );
};

export { UserProfileModal };