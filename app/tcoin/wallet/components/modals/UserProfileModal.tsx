"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Select, { type StylesConfig } from "react-select";
import countryList from "react-select-country-list";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useUpdateUserProfileMutation } from "@shared/hooks/useUserSettingsMutations";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import { Slider } from "@shared/components/ui/slider";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { uploadProfilePicture } from "@shared/lib/supabase/profilePictures";
import {
  createCroppedProfilePictureFile,
  describeProfilePictureOrientation,
  getProfilePictureCropFrame,
  prepareProfilePicture,
  type PreparedProfilePicture,
  type ProfilePictureCropState,
} from "@shared/lib/profilePictureCrop";
import { dialCodes } from "@shared/utils/countryDialCodes";
import { toast } from "react-toastify";
import { LuUser } from "react-icons/lu";
import {
  walletBadgeClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";

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
  username: string;
  nickname: string;
  country: CountryOption | null;
};

const DEFAULT_CROP_STATE: ProfilePictureCropState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
};

const CROP_PREVIEW_SIZE = 176;

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
  const { bootstrap } = useUserSettings();
  const updateProfile = useUpdateUserProfileMutation();

  useEscapeKey(closeModal);

  const profile = bootstrap?.user;
  const [initialFirstName, initialLastName] = useMemo(() => splitFullName(profile?.fullName), [profile?.fullName]);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const initialCountryOption = useMemo(
    () => getInitialCountryOption(profile?.country, countryOptions),
    [profile?.country, countryOptions]
  );

  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    const source = typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl.trim() : "";
    return source ? source : null;
  });
  const [avatarSelection, setAvatarSelection] = useState<PreparedProfilePicture | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<ProfilePictureCropState>(DEFAULT_CROP_STATE);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);

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
      username: profile?.username ?? "",
      nickname: profile?.nickname ?? "",
      country: initialCountryOption,
    },
  });

  useEffect(() => {
    reset({
      firstName: initialFirstName,
      lastName: initialLastName,
      username: profile?.username ?? "",
      nickname: profile?.nickname ?? "",
      country: initialCountryOption,
    });
  }, [initialFirstName, initialLastName, initialCountryOption, profile?.nickname, profile?.username, reset]);

  useEffect(() => {
    if (avatarSelection) {
      return;
    }
    const source = typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl.trim() : "";
    setAvatarPreview(source ? source : null);
  }, [profile?.profileImageUrl, avatarSelection]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (avatarSelection?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarSelection.previewUrl);
      }
    };
  }, [avatarPreview, avatarSelection]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsPreparingAvatar(true);
      try {
        const preparedImage = await prepareProfilePicture(file);
        if (avatarSelection?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(avatarSelection.previewUrl);
        }
        if (avatarPreview && avatarPreview.startsWith("blob:")) {
          URL.revokeObjectURL(avatarPreview);
        }
        setAvatarSelection(preparedImage);
        setAvatarCrop(DEFAULT_CROP_STATE);
        setAvatarPreview(preparedImage.previewUrl);
      } catch (error) {
        console.error("Error preparing profile picture", error);
        toast.error("We couldn't prepare that image. Please try another one.");
      } finally {
        setIsPreparingAvatar(false);
      }
      return;
    }

    if (avatarSelection?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarSelection.previewUrl);
    }
    setAvatarSelection(null);
    setAvatarCrop(DEFAULT_CROP_STATE);
    setAvatarPreview(typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl : null);
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
    if (!bootstrap?.user.id) {
      toast.error("We could not determine your account. Please try signing in again.");
      return;
    }

    try {
      let profileImageUrl = typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl : null;
      if (avatarSelection) {
        const croppedFile = await createCroppedProfilePictureFile({
          source: avatarSelection,
          crop: avatarCrop,
        });
        profileImageUrl = await uploadProfilePicture(bootstrap.user.id, croppedFile);
      }

      const firstName = values.firstName.trim();
      const lastName = values.lastName.trim();
      const countryValue = values.country?.label ?? values.country?.value ?? "";
      const nickname = values.nickname.trim();
      const username = values.username.trim().toLowerCase();

      await updateProfile.mutateAsync({
        firstName,
        lastName,
        username: username || null,
        nickname: nickname || null,
        country: countryValue || null,
        profileImageUrl,
      });
      toast.success("Profile updated successfully.");
      closeModal();
    } catch (error) {
      console.error("Error updating profile", error);
      toast.error("We couldn't update your profile. Please try again.");
    }
  };

  if (!bootstrap) {
    return <div className="text-sm text-muted-foreground">Loading profile…</div>;
  }

  const username = profile?.username ? `@${profile.username}` : undefined;
  const email = profile?.email ?? "";
  const cropFrame = avatarSelection
    ? getProfilePictureCropFrame({
        imageWidth: avatarSelection.width,
        imageHeight: avatarSelection.height,
        cropSize: CROP_PREVIEW_SIZE,
        offsetX: avatarCrop.offsetX,
        offsetY: avatarCrop.offsetY,
        zoom: avatarCrop.zoom,
      })
    : null;
  const avatarOrientation = avatarSelection
    ? describeProfilePictureOrientation(avatarSelection.width, avatarSelection.height)
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Profile</span>
        <p className="text-sm text-muted-foreground">
          Keep the personal details tied to this wallet current and easy to recognize.
        </p>
      </div>

      <div className={`${walletPanelMutedClass} flex flex-col gap-4 sm:flex-row sm:items-center`}>
        {avatarSelection && cropFrame ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-muted">
            <div
              aria-hidden="true"
              className="absolute max-w-none"
              style={{
                width: `${cropFrame.scaledWidth}px`,
                height: `${cropFrame.scaledHeight}px`,
                left: `${cropFrame.x}px`,
                top: `${cropFrame.y}px`,
                backgroundImage: `url(${avatarSelection.previewUrl})`,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
              }}
            />
          </div>
        ) : (
          <Avatar className="h-20 w-20">
            {avatarPreview ? (
              <AvatarImage src={avatarPreview} alt="Profile picture" />
            ) : (
              <AvatarFallback>
                <LuUser />
              </AvatarFallback>
            )}
          </Avatar>
        )}
        <div className="flex-1 space-y-2">
          <div className="min-w-0">
            {username && <p className="text-sm font-semibold break-words">{username}</p>}
            {email && <p className="text-sm text-muted-foreground break-words">{email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profilePicture" className={walletSectionLabelClass}>
              Profile picture
            </Label>
            <input
              id="profilePicture"
              name="profilePicture"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Upload any image, then position it inside the circle the way it should appear across the wallet.
            </p>
          </div>
        </div>
      </div>

      {avatarSelection && cropFrame ? (
        <div className={`${walletPanelMutedClass} space-y-4`}>
          <div className="space-y-1">
            <p className={walletSectionLabelClass}>Profile picture framing</p>
            <p className="text-sm text-muted-foreground">
              Adjust how your photo sits inside the circular avatar. This is the version that will be saved.
            </p>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex justify-center lg:w-[220px] lg:justify-start">
              <div
                className="relative overflow-hidden rounded-full border border-white/10 bg-background shadow-sm"
                style={{ width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE }}
              >
                <div
                  aria-hidden="true"
                  className="absolute max-w-none"
                  style={{
                    width: `${cropFrame.scaledWidth}px`,
                    height: `${cropFrame.scaledHeight}px`,
                    left: `${cropFrame.x}px`,
                    top: `${cropFrame.y}px`,
                    backgroundImage: `url(${avatarSelection.previewUrl})`,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 100%",
                  }}
                />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="profile-picture-zoom">Zoom</Label>
                  <span className="text-xs text-muted-foreground">{avatarCrop.zoom.toFixed(1)}x</span>
                </div>
                <Slider
                  id="profile-picture-zoom"
                  aria-label="Zoom"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={[avatarCrop.zoom]}
                  onValueChange={([zoom]) =>
                    setAvatarCrop((current) => ({ ...current, zoom: zoom ?? current.zoom }))
                  }
                />
              </div>

              {cropFrame.maxOffsetX > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="profile-picture-horizontal-position">Horizontal position</Label>
                    <span className="text-xs text-muted-foreground">
                      {avatarOrientation === "landscape" ? "Most useful for wide photos" : "Available after zooming"}
                    </span>
                  </div>
                  <Slider
                    id="profile-picture-horizontal-position"
                    aria-label="Horizontal position"
                    min={-100}
                    max={100}
                    step={1}
                    value={[avatarCrop.offsetX]}
                    onValueChange={([offsetX]) =>
                      setAvatarCrop((current) => ({ ...current, offsetX: offsetX ?? current.offsetX }))
                    }
                  />
                </div>
              ) : null}

              {cropFrame.maxOffsetY > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="profile-picture-vertical-position">Vertical position</Label>
                    <span className="text-xs text-muted-foreground">
                      {avatarOrientation === "portrait" ? "Most useful for tall photos" : "Available after zooming"}
                    </span>
                  </div>
                  <Slider
                    id="profile-picture-vertical-position"
                    aria-label="Vertical position"
                    min={-100}
                    max={100}
                    step={1}
                    value={[avatarCrop.offsetY]}
                    onValueChange={([offsetY]) =>
                      setAvatarCrop((current) => ({ ...current, offsetY: offsetY ?? current.offsetY }))
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className={`${walletPanelMutedClass} grid gap-4 sm:grid-cols-2`}>
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

        <div className={`${walletPanelMutedClass} space-y-4`}>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="off"
              {...register("username", {
                required: "Username is required",
                maxLength: {
                  value: 32,
                  message: "Username must be 32 characters or fewer.",
                },
                pattern: {
                  value: /^[a-z0-9._-]+$/,
                  message: "Use only lowercase letters, numbers, dots, underscores or hyphens.",
                },
              })}
            />
            {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>}
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
            <Input id="phone" type="tel" value={bootstrap.user.phone ?? ""} readOnly disabled />
            <p className="mt-1 text-xs text-muted-foreground">Phone updates stay in the verified onboarding flow.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting} className="rounded-full">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || updateProfile.isPending || isPreparingAvatar}
            className="rounded-full"
          >
            {isSubmitting || updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export { UserProfileModal };
