"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Select, { type StylesConfig } from "react-select";
import countryList from "react-select-country-list";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@shared/api/hooks/useAuth";
import { updateCubidDataInSupabase } from "@shared/api/services/supabaseService";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { createClient } from "@shared/lib/supabase/client";
import { dialCodes } from "@shared/utils/countryDialCodes";
import { toast } from "react-toastify";
import { LuUser } from "react-icons/lu";

interface UserProfileModalProps {
  closeModal: () => void;
}

type CountryOption = {
  value: string;
  label: string;
};

type FormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  country: CountryOption | null;
  phone: string;
};

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

const splitFullName = (fullName: string | null | undefined): [string, string] => {
  if (!fullName) {
    return ["", ""];
  }
  const trimmed = fullName.trim();
  if (!trimmed) {
    return ["", ""];
  }
  const parts = trimmed.split(/\s+/);
  const first = parts.shift() ?? "";
  const last = parts.join(" ");
  return [first, last];
};

const getInitialCountryOption = (country: string | null | undefined, options: CountryOption[]): CountryOption | null => {
  if (!country) {
    return null;
  }
  const normalised = country.trim().toLowerCase();
  if (!normalised) {
    return null;
  }
  return (
    options.find((option) => option.label.toLowerCase() === normalised || option.value.toLowerCase() === normalised) ?? null
  );
};

const UserProfileModal = ({ closeModal }: UserProfileModalProps) => {
  const { userData } = useAuth();
  const queryClient = useQueryClient();

  useEscapeKey(closeModal);

  const profile = userData?.cubidData;
  const [initialFirstName, initialLastName] = useMemo(() => splitFullName(profile?.full_name), [profile?.full_name]);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const initialCountryOption = useMemo(
    () => getInitialCountryOption(profile?.country, countryOptions),
    [profile?.country, countryOptions]
  );

  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    const source = typeof profile?.profile_image_url === "string" ? profile.profile_image_url.trim() : "";
    return source ? source : null;
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: initialFirstName,
      lastName: initialLastName,
      nickname: profile?.nickname ?? "",
      country: initialCountryOption,
      phone: profile?.phone ?? "",
    },
  });

  useEffect(() => {
    reset({
      firstName: initialFirstName,
      lastName: initialLastName,
      nickname: profile?.nickname ?? "",
      country: initialCountryOption,
      phone: profile?.phone ?? "",
    });
  }, [initialFirstName, initialLastName, initialCountryOption, profile?.nickname, profile?.phone, reset]);

  useEffect(() => {
    if (avatarFile) {
      return;
    }
    const source = typeof profile?.profile_image_url === "string" ? profile.profile_image_url.trim() : "";
    setAvatarPreview(source ? source : null);
  }, [profile?.profile_image_url, avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarFile(file);
    } else {
      setAvatarPreview(typeof profile?.profile_image_url === "string" ? profile.profile_image_url : null);
      setAvatarFile(null);
    }
  };

  const selectStyles = useMemo<StylesConfig<CountryOption, false>>(
    () => ({
      control: (base) => ({
        ...base,
        borderColor: errors.country ? "#ef4444" : base.borderColor,
      }),
      menu: (base) => ({
        ...base,
        zIndex: 30,
      }),
    }),
    [errors.country]
  );

  const onSubmit = async (values: FormValues) => {
    const cubidId = userData?.user?.cubid_id ?? profile?.cubid_id;
    if (!cubidId) {
      toast.error("We could not determine your account. Please try signing in again.");
      return;
    }

    try {
      let profileImageUrl = typeof profile?.profile_image_url === "string" ? profile.profile_image_url : null;
      if (avatarFile) {
        const supabase = createClient();
        const fileExt = avatarFile.name.split(".").pop() ?? "png";
        const recordId = profile?.id ?? userData?.user?.id ?? "profile";
        const fileName = `${recordId}.${fileExt}`;
        const filePath = `profile_pictures/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("profile_pictures").upload(filePath, avatarFile, {
          cacheControl: "3600",
          upsert: true,
        });
        if (uploadError) {
          throw new Error(uploadError.message);
        }
        const { data } = supabase.storage.from("profile_pictures").getPublicUrl(filePath);
        profileImageUrl = data?.publicUrl ?? profileImageUrl;
      }

      const firstName = values.firstName.trim();
      const lastName = values.lastName.trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const countryValue = values.country?.label ?? values.country?.value ?? "";
      const nickname = values.nickname.trim();
      const phone = values.phone.trim();

      const { error } = await updateCubidDataInSupabase(cubidId, {
        full_name: fullName,
        nickname: nickname || null,
        country: countryValue,
        phone: phone || null,
        profile_image_url: profileImageUrl,
      });

      if (error) {
        throw new Error(error.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["user-data"] });
      toast.success("Profile updated successfully.");
      closeModal();
    } catch (error) {
      console.error("Error updating profile", error);
      toast.error("We couldn't update your profile. Please try again.");
    }
  };

  const username = profile?.username ? `@${profile.username}` : undefined;
  const email = profile?.email ?? userData?.user?.email ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20">
          {avatarPreview ? (
            <AvatarImage src={avatarPreview} alt="Profile picture" />
          ) : (
            <AvatarFallback>
              <LuUser />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="min-w-0">
            {username && <p className="text-sm font-semibold break-words">{username}</p>}
            {email && <p className="text-sm text-muted-foreground break-words">{email}</p>}
          </div>
          <div>
            <Label htmlFor="profilePicture">Profile picture</Label>
            <input
              id="profilePicture"
              name="profilePicture"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="mt-1 block w-full text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Upload a square image for the best fit.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" {...register("firstName", { required: "First name is required" })} />
            {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" {...register("lastName", { required: "Last name is required" })} />
            {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="nickname">Preferred name</Label>
          <Input id="nickname" {...register("nickname")} placeholder="What should we call you?" />
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <Controller
            name="country"
            control={control}
            rules={{ required: "Country is required" }}
            render={({ field }) => (
              <Select
                {...field}
                options={countryOptions}
                styles={selectStyles}
                placeholder="Select a country"
                classNamePrefix="country-select"
                value={field.value}
                onChange={(option) => field.onChange(option)}
                menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
              />
            )}
          />
          {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country.message}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" placeholder="Include your country code" {...register("phone")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export { UserProfileModal };
