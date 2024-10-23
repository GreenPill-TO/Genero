import { Avatar } from "@/components/ui/Avatar";
import React, { useState } from "react";

interface ImageUploadProps {
  label: string;
  name: string;
  onImageUpload: (file: File | null) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, name, onImageUpload }) => {
  const [preview, setPreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onImageUpload(file);
    } else {
      setPreview(null);
      onImageUpload(null);
    }
  };

  return (
    <div className="image-upload">
      {preview && <Avatar className="my-4" src={preview} alt="image-preview" />}
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input type="file" id={name} name={name} accept="image/*" onChange={handleImageChange} className="mt-1 block w-full text-sm text-gray-900" />
    </div>
  );
};

export default ImageUpload;
