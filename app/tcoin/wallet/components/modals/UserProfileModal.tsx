"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import Select, { type InputActionMeta, type StylesConfig } from "react-select";
import countryList from "react-select-country-list";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useUpdateUserProfileMutation } from "@shared/hooks/useUserSettingsMutations";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { fileInputFieldClass, reactSelectFieldShellClass } from "@shared/components/ui/formFieldStyles";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import { Textarea } from "@shared/components/ui/TextArea";
import { Slider } from "@shared/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/components/ui/tooltip";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { uploadProfilePicture } from "@shared/lib/supabase/profilePictures";
import {
  createCroppedProfilePictureFile,
  describeProfilePictureOrientation,
  getProfilePictureCropFrame,
  prepareProfilePicture,
  prepareProfilePictureFromUrl,
  type PreparedProfilePicture,
  type ProfilePictureCropState,
} from "@shared/lib/profilePictureCrop";
import { dialCodes } from "@shared/utils/countryDialCodes";
import { toast } from "react-toastify";
import { LuCircleHelp, LuUser } from "react-icons/lu";
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
  emails: Array<{
    email: string;
    isPrimary: boolean;
  }>;
  country: CountryOption | null;
  address: string;
};

const DEFAULT_CROP_STATE: ProfilePictureCropState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
};

const AVATAR_PREVIEW_SIZE = 80;
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

const getInitialEmails = (
  profile:
    | {
        email?: string | null;
        emails?: Array<{
          email: string;
          isPrimary: boolean;
        }>;
      }
    | null
    | undefined
) => {
  const knownEmails = Array.isArray(profile?.emails)
    ? profile.emails
        .map((entry) => ({
          email: typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "",
          isPrimary: entry.isPrimary === true,
        }))
        .filter((entry) => entry.email.length > 0)
    : [];

  if (knownEmails.length > 0) {
    if (knownEmails.length === 1) {
      return [{ ...knownEmails[0], isPrimary: true }];
    }

    const hasPrimary = knownEmails.some((entry) => entry.isPrimary);
    return knownEmails.map((entry, index) => ({
      email: entry.email,
      isPrimary: hasPrimary ? entry.isPrimary : index === 0,
    }));
  }

  const fallbackEmail = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (fallbackEmail) {
    return [
      {
        email: fallbackEmail,
        isPrimary: true,
      },
    ];
  }

  return [
    {
      email: "",
      isPrimary: true,
    },
  ];
};

const UserProfileModal = ({ closeModal }: UserProfileModalProps) => {
  const { bootstrap } = useUserSettings();
  const updateProfile = useUpdateUserProfileMutation();

  useEscapeKey(closeModal);

  const profile = bootstrap?.user;
  const [initialFirstName, initialLastName] = useMemo(() => splitFullName(profile?.fullName), [profile?.fullName]);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
  const initialEmails = useMemo(() => getInitialEmails(profile), [profile]);
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
  const [countrySearchInput, setCountrySearchInput] = useState("");

  const existingProfileImageUrl = useMemo(() => {
    const source = typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl.trim() : "";
    return source || null;
  }, [profile?.profileImageUrl]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: initialFirstName,
      lastName: initialLastName,
      username: profile?.username ?? "",
      nickname: profile?.nickname ?? "",
      emails: initialEmails,
      country: initialCountryOption,
      address: profile?.address ?? "",
    },
  });
  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({
    control,
    name: "emails",
  });
  const safeWatchedEmails = watch("emails", initialEmails);

  useEffect(() => {
    reset({
      firstName: initialFirstName,
      lastName: initialLastName,
      username: profile?.username ?? "",
      nickname: profile?.nickname ?? "",
      emails: initialEmails,
      country: initialCountryOption,
      address: profile?.address ?? "",
    });
  }, [initialEmails, initialFirstName, initialLastName, initialCountryOption, profile?.address, profile?.nickname, profile?.username, reset]);

  useEffect(() => {
    if (avatarSelection) {
      return;
    }
    setAvatarPreview(existingProfileImageUrl);
  }, [existingProfileImageUrl, avatarSelection]);

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
    setAvatarPreview(existingProfileImageUrl);
  };

  const handleEditCurrentPhoto = async () => {
    if (!existingProfileImageUrl) {
      return;
    }

    setIsPreparingAvatar(true);
    try {
      const preparedImage = await prepareProfilePictureFromUrl(
        existingProfileImageUrl,
        profile?.username?.trim() || "profile-picture"
      );
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
      console.error("Error preparing existing profile picture", error);
      toast.error("We couldn't open your current photo for editing. Please try again.");
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  useEffect(() => {
    if (safeWatchedEmails.length !== 1) {
      return;
    }

    if (safeWatchedEmails[0]?.isPrimary) {
      return;
    }

    setValue("emails.0.isPrimary", true, { shouldDirty: true });
  }, [safeWatchedEmails, setValue]);

  const setPrimaryEmail = (index: number) => {
    safeWatchedEmails.forEach((_, currentIndex) => {
      setValue(`emails.${currentIndex}.isPrimary`, currentIndex === index, { shouldDirty: true });
    });
  };

  const addAnotherEmail = () => {
    appendEmail({
      email: "",
      isPrimary: safeWatchedEmails.length === 0,
    });
  };

  const removeManagedEmail = (index: number) => {
    if (safeWatchedEmails.length <= 1 || safeWatchedEmails[index]?.isPrimary) {
      return;
    }

    removeEmail(index);
  };

  const selectStyles = useMemo<StylesConfig<CountryOption, false>>(
    () => ({
      control: (base) => ({
        ...base,
        backgroundColor: "transparent",
        borderColor: errors.country ? "#ef4444" : "transparent",
        borderRadius: "0.75rem",
        minHeight: "2.5rem",
        boxShadow: "none",
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 0.75rem",
      }),
      input: (base) => ({
        ...base,
        color: "inherit",
      }),
      placeholder: (base) => ({
        ...base,
        color: "hsl(var(--muted-foreground))",
      }),
      singleValue: (base) => ({
        ...base,
        color: "inherit",
      }),
      menu: (base) => ({
        ...base,
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow:
          "0 20px 45px -24px rgba(15, 23, 42, 0.45), 0 12px 20px -18px rgba(15, 23, 42, 0.24)",
        zIndex: 30,
      }),
      menuList: (base) => ({
        ...base,
        padding: "0.35rem",
      }),
      option: (base, state) => ({
        ...base,
        borderRadius: "0.85rem",
        backgroundColor: state.isFocused ? "hsl(var(--accent))" : "transparent",
        color: state.isFocused ? "hsl(var(--accent-foreground))" : "inherit",
      }),
    }),
    [errors.country]
  );

  const isCountryMenuOpen = countrySearchInput.trim().length > 0;

  const handleCountryInputChange = (nextValue: string, meta: InputActionMeta) => {
    if (meta.action === "input-change") {
      setCountrySearchInput(nextValue);
      return nextValue;
    }

    if (meta.action === "input-blur" || meta.action === "menu-close" || meta.action === "set-value") {
      setCountrySearchInput("");
      return "";
    }

    return nextValue;
  };

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
      const address = values.address.trim();
      const nickname = values.nickname.trim();
      const username = values.username.trim().toLowerCase();
      const emails = values.emails.map((entry) => ({
        email: entry.email.trim().toLowerCase(),
        isPrimary: entry.isPrimary,
      }));

      await updateProfile.mutateAsync({
        firstName,
        lastName,
        username: username || null,
        nickname: nickname || null,
        emails,
        country: countryValue || null,
        address: address || null,
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
  const avatarPreviewFrame = avatarSelection
    ? getProfilePictureCropFrame({
        imageWidth: avatarSelection.width,
        imageHeight: avatarSelection.height,
        cropSize: AVATAR_PREVIEW_SIZE,
        offsetX: avatarCrop.offsetX,
        offsetY: avatarCrop.offsetY,
        zoom: avatarCrop.zoom,
      })
    : null;
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

  const renderTooltip = (message: string) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            aria-label={message}
          >
            <LuCircleHelp className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-balance">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Profile</span>
        <p className="text-sm text-muted-foreground">
          Keep the personal details tied to this wallet current and easy to recognize.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`} data-testid="profile-picture-panel">
            <div className="space-y-1">
              <p className={walletSectionLabelClass}>Picture</p>
              <p className="text-sm text-muted-foreground">
                Upload any image, then frame it the way it should appear across the wallet.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
              <div className="flex items-start justify-center sm:justify-start">
                {avatarSelection && avatarPreviewFrame ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-muted">
                    <div
                      aria-hidden="true"
                      className="absolute max-w-none"
                      style={{
                        width: `${avatarPreviewFrame.scaledWidth}px`,
                        height: `${avatarPreviewFrame.scaledHeight}px`,
                        left: `${avatarPreviewFrame.x}px`,
                        top: `${avatarPreviewFrame.y}px`,
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
              </div>

              <div className="space-y-3">
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
                    className={fileInputFieldClass}
                  />
                </div>

                {existingProfileImageUrl && !avatarSelection ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleEditCurrentPhoto}
                    disabled={isPreparingAvatar}
                    className="rounded-full"
                  >
                    {isPreparingAvatar ? "Opening current photo..." : "Adjust current photo"}
                  </Button>
                ) : null}
              </div>
            </div>

            {avatarSelection && cropFrame ? (
              <div className="space-y-4 border-t border-slate-200/60 pt-4 dark:border-white/10">
                <div className="space-y-1">
                  <p className={walletSectionLabelClass}>Profile picture framing</p>
                  <p className="text-sm text-muted-foreground">
                    Adjust how your photo sits inside the circular avatar. This is the version that will be saved.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
                  <div className="flex justify-center sm:justify-start">
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

                  <div className="space-y-4">
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
          </div>

          <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`} data-testid="profile-email-panel">
            <div className="space-y-1">
              <p className={walletSectionLabelClass}>Email</p>
              <p className="text-sm text-muted-foreground">
                Keep one primary email on the account, and add other active addresses as needed. Deleted emails are retired
                from this account but can be reused later elsewhere.
              </p>
            </div>

            <div className="space-y-3">
              {emailFields.map((field, index) => {
                const isPrimary = safeWatchedEmails[index]?.isPrimary === true || safeWatchedEmails.length === 1;
                const disableRemove = safeWatchedEmails.length <= 1 || isPrimary;
                const emailError = errors.emails?.[index]?.email?.message;

                return (
                  <div key={field.id} className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor={`email-${field.id}`}>Email address {index + 1}</Label>
                      <div className="flex items-center gap-2">
                        {isPrimary ? (
                          <span className={walletBadgeClass}>Primary</span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-full px-3 py-1 text-xs"
                            onClick={() => setPrimaryEmail(index)}
                          >
                            Make primary
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-full px-3 py-1 text-xs"
                          onClick={() => removeManagedEmail(index)}
                          disabled={disableRemove}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <Input
                      id={`email-${field.id}`}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@example.com"
                      {...register(`emails.${index}.email`, {
                        required: "Email address is required.",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Enter a valid email address.",
                        },
                      })}
                    />
                    {emailError ? <p className="text-sm text-red-500">{emailError}</p> : null}
                    {disableRemove ? (
                      <p className="text-xs text-muted-foreground">
                        {safeWatchedEmails.length <= 1
                          ? "There must always be at least one email address on the account."
                          : "Choose a different primary email before removing this one."}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <Button type="button" variant="ghost" onClick={addAnotherEmail} className="rounded-full">
                Add another email
              </Button>
              {username ? (
                <p className="text-sm font-semibold break-words">{username}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Add a username below so people in the app can find you more easily.</p>
              )}
            </div>
          </div>

          <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`} data-testid="profile-banking-panel">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className={walletSectionLabelClass}>Banking info</p>
              {renderTooltip("This info won't be shared with other users.")}
            </div>
            <p className="text-sm text-muted-foreground">
              These details describe you as the account holder and help the wallet present your profile consistently.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">Given name(s)</Label>
              <Input id="firstName" {...register("firstName", { required: "First name is required" })} />
              {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName", { required: "Last name is required" })} />
              {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="country">Country or Country number</Label>
              <Controller
                name="country"
                control={control}
                rules={{ required: "Country is required" }}
                render={({ field }) => (
                  <Select
                    {...field}
                    inputId="country"
                    options={countryOptions}
                    styles={selectStyles}
                    placeholder="Type a country or country number"
                    className={`text-sm ${reactSelectFieldShellClass}`}
                    classNamePrefix="country-select"
                    value={field.value}
                    openMenuOnFocus={false}
                    menuIsOpen={isCountryMenuOpen}
                    inputValue={countrySearchInput}
                    noOptionsMessage={() =>
                      isCountryMenuOpen ? "No matching country or dial code." : "Start typing to see options."
                    }
                    filterOption={(option, inputValue) => {
                      const search = inputValue.trim().toLowerCase();
                      if (!search) {
                        return false;
                      }
                      return (
                        option.label.toLowerCase().includes(search) || option.value.toLowerCase().includes(search)
                      );
                    }}
                    onInputChange={handleCountryInputChange}
                    onChange={(option) => {
                      setCountrySearchInput("");
                      field.onChange(option);
                    }}
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

          <div>
            <div className="mb-1 flex items-center gap-2">
              <Label htmlFor="address">Address</Label>
              {renderTooltip("We only need an address before any withdrawals, so you can leave this blank until then.")}
            </div>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="123 Main St, Toronto, ON M5V 2T6"
              className="min-h-24"
            />
          </div>
        </div>

        <div className={`${walletPanelMutedClass} space-y-4 lg:h-full`} data-testid="profile-app-info-panel">
          <div className="space-y-1">
            <p className={walletSectionLabelClass}>Info used in this app</p>
            <p className="text-sm text-muted-foreground">
              These settings shape how your name and handle appear inside this wallet experience.
            </p>
          </div>

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
