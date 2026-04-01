"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { Badge } from "@shared/components/ui/badge";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/Select";
import { Textarea } from "@shared/components/ui/TextArea";
import type { MerchantApplicationStatusResponse } from "@shared/lib/merchantSignup/types";
import { getBiaList } from "@shared/lib/edge/biaClient";
import {
  getMerchantApplicationStatus,
  restartMerchantApplication,
  saveMerchantApplicationStep,
  startMerchantApplication,
  submitMerchantApplication,
} from "@shared/lib/edge/merchantApplicationsClient";
import { createClient } from "@shared/lib/supabase/client";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import { walletPageClass } from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { LiveMerchantDashboard } from "./LiveMerchantDashboard";
import { cn } from "@shared/utils/classnames";

const CITY_SLUG = "tcoin";
const MERCHANT_ASSET_BUCKET = "merchant_assets";

type BiaRecord = {
  id: string;
  code: string;
  name: string;
};

type SignupForm = {
  consentAccepted: boolean;
  displayName: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  addressText: string;
  lat: string;
  lng: string;
  biaId: string;
  slug: string;
};

type ImageField = "logoUrl" | "bannerUrl";

const EMPTY_FORM: SignupForm = {
  consentAccepted: false,
  displayName: "",
  description: "",
  logoUrl: "",
  bannerUrl: "",
  addressText: "",
  lat: "",
  lng: "",
  biaId: "",
  slug: "",
};

const lifecycleLabel: Record<string, string> = {
  none: "Not started",
  draft: "Draft",
  pending: "Pending approval",
  live: "Live",
  rejected: "Rejected",
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
  }

  return body as T;
}

export default function MerchantDashboardPage() {
  const { isLoadingUser, error } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<MerchantApplicationStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [biaOptions, setBiaOptions] = useState<BiaRecord[]>([]);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isAddressEditing, setIsAddressEditing] = useState(true);
  const [slugCheck, setSlugCheck] = useState<{ available: boolean; checkedSlug: string } | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<{ logoUrl: boolean; bannerUrl: boolean }>({
    logoUrl: false,
    bannerUrl: false,
  });
  const [isDraggingImage, setIsDraggingImage] = useState<{ logoUrl: boolean; bannerUrl: boolean }>({
    logoUrl: false,
    bannerUrl: false,
  });
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const bannerPreviewRef = useRef<string | null>(null);

  const appState = status?.state ?? "none";
  const isDraft = appState === "draft";
  const isPending = appState === "pending";
  const isRejected = appState === "rejected";
  const isLive = appState === "live";

  const storeId = status?.storeId ?? null;
  const mainClass = cn(walletPageClass, "font-sans min-h-screen text-foreground lg:pl-40 xl:pl-44");

  const handleTabChange = (next: string) => {
    if (next === "home") {
      router.push("/dashboard");
      return;
    }
    router.push(`/dashboard?tab=${encodeURIComponent(next)}`);
  };

  const syncFormFromStatus = useCallback((nextStatus: MerchantApplicationStatusResponse) => {
    const app = nextStatus.application;
    if (!app) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm((prev) => ({
      ...prev,
      displayName: app.profile.displayName ?? "",
      description: app.profile.description ?? "",
      logoUrl: app.profile.logoUrl ?? "",
      bannerUrl: app.profile.bannerUrl ?? "",
      addressText: app.profile.addressText ?? "",
      lat: app.profile.lat != null ? String(app.profile.lat) : "",
      lng: app.profile.lng != null ? String(app.profile.lng) : "",
      biaId: app.bia?.id ?? "",
      slug: app.profile.slug ?? "",
    }));
    const hasCoords = app.profile.lat != null && app.profile.lng != null;
    setIsAddressEditing(!hasCoords);
    if (app.profile.slug) {
      setSlugCheck({ available: true, checkedSlug: app.profile.slug.toLowerCase() });
    }
  }, []);

  useEffect(() => {
    logoPreviewRef.current = logoPreviewUrl;
  }, [logoPreviewUrl]);

  useEffect(() => {
    bannerPreviewRef.current = bannerPreviewUrl;
  }, [bannerPreviewUrl]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewRef.current);
      }
      if (bannerPreviewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(bannerPreviewRef.current);
      }
    };
  }, []);

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const next = (await getMerchantApplicationStatus({ citySlug: CITY_SLUG })) as MerchantApplicationStatusResponse;
      setStatus(next);
      if (next.signupStep && Number.isFinite(next.signupStep)) {
        setWizardStep(Math.max(1, Math.min(5, Number(next.signupStep))));
      }
      syncFormFromStatus(next);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Failed to load merchant application status.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [syncFormFromStatus]);

  useEffect(() => {
    if (!isLoadingUser) {
      void loadStatus();
    }
  }, [isLoadingUser, loadStatus]);

  useEffect(() => {
    const loadBiaOptions = async () => {
      if (!showWizard || wizardStep < 4) {
        return;
      }
      try {
        const response = (await getBiaList({
          appContext: { citySlug: CITY_SLUG },
        })) as { bias?: BiaRecord[] };
        setBiaOptions(Array.isArray(response.bias) ? response.bias : []);
      } catch {
        setBiaOptions([]);
      }
    };

    void loadBiaOptions();
  }, [showWizard, wizardStep]);

  const startApplication = async (forceNew: boolean) => {
    try {
      const response = (await startMerchantApplication({ forceNew }, { citySlug: CITY_SLUG })) as { signupStep?: number };
      await loadStatus();
      setShowWizard(true);
      setWizardStep(response.signupStep && Number.isFinite(response.signupStep) ? Number(response.signupStep) : 1);
      toast.success("Merchant application started.");
    } catch (startError) {
      toast.error(startError instanceof Error ? startError.message : "Could not start merchant application.");
    }
  };

  const restartApplication = async () => {
    try {
      const response = (await restartMerchantApplication({}, { citySlug: CITY_SLUG })) as { signupStep?: number };
      await loadStatus();
      setShowWizard(true);
      setWizardStep(response.signupStep && Number.isFinite(response.signupStep) ? Number(response.signupStep) : 1);
      setSlugCheck(null);
      toast.success("Started a new merchant application.");
    } catch (restartError) {
      toast.error(restartError instanceof Error ? restartError.message : "Could not restart merchant application.");
    }
  };

  const lookupAddress = async () => {
    if (!form.addressText.trim()) {
      toast.error("Enter an address to geocode first.");
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetchJson<{ normalizedAddress: string; lat: number; lng: number }>(
        "/api/merchant/geocode",
        {
          method: "POST",
          body: JSON.stringify({ citySlug: CITY_SLUG, address: form.addressText.trim() }),
        }
      );

      setForm((prev) => ({
        ...prev,
        addressText: response.normalizedAddress,
        lat: String(response.lat),
        lng: String(response.lng),
      }));
      setIsAddressEditing(false);
      toast.success("Address matched successfully.");
    } catch (geoError) {
      toast.error(geoError instanceof Error ? geoError.message : "Could not geocode that address.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const checkSlugAvailability = async () => {
    if (!form.slug.trim()) {
      setSlugCheck(null);
      return;
    }

    try {
      const response = await fetchJson<{ available: boolean; slug: string }>(
        `/api/merchant/slug-availability?citySlug=${CITY_SLUG}&slug=${encodeURIComponent(form.slug.trim())}${
          storeId ? `&excludeStoreId=${storeId}` : ""
        }`
      );
      setSlugCheck({ available: response.available, checkedSlug: response.slug });
    } catch (slugError) {
      toast.error(slugError instanceof Error ? slugError.message : "Could not check slug availability.");
      setSlugCheck(null);
    }
  };

  const setPreviewUrl = (field: ImageField, nextUrl: string | null) => {
    if (field === "logoUrl") {
      setLogoPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return nextUrl;
      });
      return;
    }
    setBannerPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });
  };

  const uploadStoreImage = async (field: ImageField, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(field, previewUrl);
    setUploadingImage((prev) => ({ ...prev, [field]: true }));

    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
      const scope = storeId ? `store-${storeId}` : "draft";
      const filePath = `merchant_assets/${scope}/${field}-${Date.now()}-${safeName || `asset.${extension}`}`;

      const { error: uploadError } = await supabase.storage.from(MERCHANT_ASSET_BUCKET).upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from(MERCHANT_ASSET_BUCKET).getPublicUrl(filePath);
      const publicUrl = data?.publicUrl ?? null;
      if (!publicUrl) {
        throw new Error("Could not resolve image URL after upload.");
      }

      setForm((prev) => ({ ...prev, [field]: publicUrl }));
      setPreviewUrl(field, publicUrl);
      toast.success(field === "logoUrl" ? "Logo uploaded." : "Banner uploaded.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Could not upload image.");
      setPreviewUrl(field, null);
    } finally {
      setUploadingImage((prev) => ({ ...prev, [field]: false }));
      if (field === "logoUrl" && logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
      if (field === "bannerUrl" && bannerFileInputRef.current) {
        bannerFileInputRef.current.value = "";
      }
    }
  };

  const handleImageInputChange = async (field: ImageField, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadStoreImage(field, file);
  };

  const handleImageDrop = async (field: ImageField, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage((prev) => ({ ...prev, [field]: false }));
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadStoreImage(field, file);
  };

  const inputForField = (field: ImageField) => (field === "logoUrl" ? logoFileInputRef : bannerFileInputRef);
  const labelForField = (field: ImageField) => (field === "logoUrl" ? "Logo image" : "Banner image");
  const previewForField = (field: ImageField) =>
    (field === "logoUrl" ? logoPreviewUrl : bannerPreviewUrl) || form[field] || null;
  const isUploadingField = (field: ImageField) => uploadingImage[field];

  const currentStepPayload = useMemo(() => {
    if (wizardStep === 1) {
      return { consentAccepted: form.consentAccepted };
    }
    if (wizardStep === 2) {
      return {
        displayName: form.displayName.trim(),
        description: form.description.trim(),
        logoUrl: form.logoUrl.trim(),
        bannerUrl: form.bannerUrl.trim(),
      };
    }
    if (wizardStep === 3) {
      return {
        addressText: form.addressText.trim(),
        lat: Number.parseFloat(form.lat),
        lng: Number.parseFloat(form.lng),
      };
    }
    if (wizardStep === 4) {
      return { biaId: form.biaId };
    }
    return { slug: form.slug.trim().toLowerCase() };
  }, [wizardStep, form]);

  const normalisedSlug = useMemo(() => form.slug.trim().toLowerCase(), [form.slug]);
  const geocodeReady = useMemo(() => {
    const lat = Number.parseFloat(form.lat);
    const lng = Number.parseFloat(form.lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }, [form.lat, form.lng]);

  const isCurrentStepComplete = useMemo(() => {
    if (wizardStep === 1) {
      return form.consentAccepted;
    }
    if (wizardStep === 2) {
      return (
        form.displayName.trim().length > 0 &&
        form.description.trim().length > 0 &&
        form.logoUrl.trim().length > 0 &&
        form.bannerUrl.trim().length > 0 &&
        !uploadingImage.logoUrl &&
        !uploadingImage.bannerUrl
      );
    }
    if (wizardStep === 3) {
      return form.addressText.trim().length > 0 && geocodeReady && !isAddressEditing;
    }
    if (wizardStep === 4) {
      return form.biaId.trim().length > 0;
    }
    const slugMatchesCheck = slugCheck?.checkedSlug === normalisedSlug;
    return normalisedSlug.length > 0 && slugCheck?.available === true && slugMatchesCheck;
  }, [wizardStep, form, geocodeReady, isAddressEditing, slugCheck, normalisedSlug, uploadingImage.logoUrl, uploadingImage.bannerUrl]);

  const mapEmbedSrc = useMemo(() => {
    if (!geocodeReady) return null;
    const lat = Number.parseFloat(form.lat);
    const lng = Number.parseFloat(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    // Approximate a neighborhood-scale viewport (~1000m total span).
    const latSpan = 1000 / 111_320;
    const lngSpan = 1000 / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
    const minLat = lat - latSpan / 2;
    const maxLat = lat + latSpan / 2;
    const minLng = lng - lngSpan / 2;
    const maxLng = lng + lngSpan / 2;
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox
    )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  }, [geocodeReady, form.lat, form.lng]);

  const addressDisplayLines = useMemo(() => {
    return form.addressText
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }, [form.addressText]);

  const saveCurrentStep = async () => {
    if (!storeId) {
      toast.error("No draft application found to save.");
      return false;
    }

    setIsSavingStep(true);
    try {
      await saveMerchantApplicationStep(
        {
          storeId,
          step: wizardStep,
          payload: currentStepPayload,
        },
        { citySlug: CITY_SLUG }
      );
      await loadStatus();
      return true;
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save this signup step.");
      return false;
    } finally {
      setIsSavingStep(false);
    }
  };

  const nextStep = async () => {
    const ok = await saveCurrentStep();
    if (!ok) return;
    setWizardStep((prev) => Math.min(5, prev + 1));
  };

  const submitApplication = async () => {
    if (!storeId) {
      toast.error("No draft application found to submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await saveCurrentStep();
      if (!ok) return;

      await submitMerchantApplication({ storeId }, { citySlug: CITY_SLUG });
      await loadStatus();
      setShowWizard(false);
      toast.success("Merchant application submitted for city-manager review.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Could not submit merchant application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className={mainClass}>
        <div className="text-sm">Error loading user data: {error.message}</div>
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  if (isLoadingUser || isLoadingStatus) {
    return (
      <div className={mainClass}>
        <div className="text-sm">Loading merchant workspace…</div>
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  if (isLive) {
    return (
      <div className={mainClass}>
        <LiveMerchantDashboard />
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  return (
    <div className={mainClass}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Merchant Dashboard</h1>
            <p className="text-sm text-muted-foreground">Apply to become a live merchant store in your city.</p>
          </div>
          <Badge variant="outline">Status: {lifecycleLabel[appState] ?? appState}</Badge>
        </div>
 

      {appState === "none" && (
        <Card>
          <CardHeader>
            <CardTitle>Sign up as Merchant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Complete a guided 5-step application so the city manager can review and approve your store.
            </p>
            <Button onClick={() => void startApplication(false)}>Start merchant application</Button>
          </CardContent>
        </Card>
      )}

      {isDraft && !showWizard && (
        <Card>
          <CardHeader>
            <CardTitle>It looks like you have an ongoing application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Continue from step {status?.signupStep ?? 1}, or start a new application to clear your current draft.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowWizard(true)}>Continue</Button>
              <Button variant="outline" onClick={() => void restartApplication()}>
                Start new application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isDraft && showWizard && (
        <Card>
          <CardHeader>
            <CardTitle>Merchant Signup (Step {wizardStep} of 5)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {wizardStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Merchants sign up to accept TCOIN payments, including partial payments. Each merchant belongs to one
                  neighbourhood/BIA. Payments you receive may come as TCOIN or as tokens from other local merchants in
                  the same BIA.
                </p>
                <p className="text-sm text-muted-foreground">
                  Only TCOIN can be redeemed for CADm on CELO. Redemptions use a predetermined exchange rate of 97% of
                  par (3% below par), and the remaining 3% is retained to fund the charitable donation flow built into
                  the system.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.consentAccepted}
                    onChange={(event) => setForm((prev) => ({ ...prev, consentAccepted: event.target.checked }))}
                  />
                  I understand merchant responsibilities and want to continue.
                </label>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Input
                    placeholder="Store name"
                    value={form.displayName}
                    onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  />
                  <Textarea
                    placeholder="Store description"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />

                  {(["bannerUrl", "logoUrl"] as ImageField[]).map((field) => (
                    <div key={field} className="space-y-2">
                      <p className="text-sm font-medium">{labelForField(field)}</p>
                      <div
                        className={`rounded-md border border-dashed p-4 text-sm ${
                          isDraggingImage[field] ? "border-pink-400 bg-pink-50/40 dark:bg-pink-950/20" : "border-border"
                        }`}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          setIsDraggingImage((prev) => ({ ...prev, [field]: true }));
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => setIsDraggingImage((prev) => ({ ...prev, [field]: false }))}
                        onDrop={(event) => void handleImageDrop(field, event)}
                      >
                        <input
                          ref={inputForField(field)}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => void handleImageInputChange(field, event)}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => inputForField(field).current?.click()}
                            disabled={isUploadingField(field)}
                          >
                            Browse files
                          </Button>
                          <span className="text-xs text-muted-foreground">or drag and drop image here</span>
                        </div>
                        {isUploadingField(field) && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-3">Store page preview</p>
                  <div className="relative mb-10">
                    <div className="relative h-28 w-full overflow-hidden rounded-lg border bg-muted/40">
                      {previewForField("bannerUrl") ? (
                        <Image
                          src={previewForField("bannerUrl") ?? ""}
                          alt="Store banner preview"
                          fill
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full border-2 border-dashed border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="absolute left-4 top-full -translate-y-1/2 h-20 w-20 overflow-hidden rounded-full border-4 border-background bg-muted shadow-sm">
                      {previewForField("logoUrl") ? (
                        <Image
                          src={previewForField("logoUrl") ?? ""}
                          alt="Store logo preview"
                          fill
                          sizes="80px"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full border-2 border-dashed border-muted-foreground/30 rounded-full" />
                      )}
                    </div>
                  </div>
                  <div className="pt-4 space-y-2">
                    <p className="text-base font-semibold">{form.displayName.trim() || "Your store name"}</p>
                    <p className="text-sm text-muted-foreground">
                      {form.description.trim() || "Your store description will appear here as you type."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-3">
                {isAddressEditing ? (
                  <Textarea
                    placeholder="123 Main St, Smallville, England"
                    className="placeholder:text-muted-foreground/55"
                    value={form.addressText}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, addressText: event.target.value, lat: "", lng: "" }))
                    }
                  />
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Geocoded address</p>
                    {addressDisplayLines.length > 0 ? (
                      addressDisplayLines.map((line, index) => (
                        <p key={`${line}-${index}`} className="text-sm leading-5">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm leading-5">{form.addressText}</p>
                    )}
                  </div>
                )}
                {geocodeReady && (
                  <div className="flex gap-2">
                    <div className="flex-1 px-1 py-1">
                      <p className="text-xs text-muted-foreground">Latitude</p>
                      <p className="text-sm">{form.lat}</p>
                    </div>
                    <div className="flex-1 px-1 py-1">
                      <p className="text-xs text-muted-foreground">Longitude</p>
                      <p className="text-sm">{form.lng}</p>
                    </div>
                  </div>
                )}
                {mapEmbedSrc && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Map preview</p>
                    <div className="h-40 overflow-hidden rounded-md border">
                      <iframe
                        title="Store location preview"
                        src={mapEmbedSrc}
                        className="h-full w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {wizardStep === 4 && (
              <Select value={form.biaId || undefined} onValueChange={(value) => setForm((prev) => ({ ...prev, biaId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select BIA" />
                </SelectTrigger>
                <SelectContent>
                  {biaOptions.map((bia) => (
                    <SelectItem key={bia.id} value={bia.id}>
                      {bia.code} · {bia.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {wizardStep === 5 && (
              <div className="space-y-3">
                <Input
                  placeholder="Store slug (e.g. king-west-cafe)"
                  value={form.slug}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, slug: event.target.value.toLowerCase().trim() }));
                    setSlugCheck(null);
                  }}
                />
                <Button variant="outline" onClick={() => void checkSlugAvailability()}>
                  Check slug availability
                </Button>
                {slugCheck && (
                  <p className={`text-xs ${slugCheck.available ? "text-emerald-600" : "text-red-600"}`}>
                    {slugCheck.available
                      ? `Slug '${slugCheck.checkedSlug}' is available.`
                      : `Slug '${slugCheck.checkedSlug}' is already taken.`}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              {wizardStep === 1 ? (
                <Button variant="outline" onClick={() => setShowWizard(false)} disabled={isSavingStep || isSubmitting}>
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                  disabled={isSavingStep || isSubmitting}
                >
                  Back
                </Button>
              )}
              <div className="flex items-center gap-2">
                {wizardStep === 3 && (
                  <>
                    {isAddressEditing ? (
                      <Button
                        type="button"
                        onClick={() => void lookupAddress()}
                        disabled={isGeocoding || isSavingStep || isSubmitting || form.addressText.trim().length === 0}
                      >
                        {isGeocoding ? "Finding..." : "Find this address"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddressEditing(true);
                          setForm((prev) => ({ ...prev, lat: "", lng: "" }));
                        }}
                        disabled={isSavingStep || isSubmitting}
                      >
                        Edit address
                      </Button>
                    )}
                  </>
                )}
                {wizardStep < 5 ? (
                  <Button onClick={() => void nextStep()} disabled={!isCurrentStepComplete || isSavingStep || isSubmitting}>
                    {isSavingStep ? "Saving…" : "Save and continue"}
                  </Button>
                ) : (
                  <Button onClick={() => void submitApplication()} disabled={!isCurrentStepComplete || isSavingStep || isSubmitting}>
                    {isSubmitting ? "Submitting…" : "Submit application"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <Alert>
          <AlertTitle>Application pending review</AlertTitle>
          <AlertDescription>
            Your store application has been submitted and is awaiting city-manager approval.
          </AlertDescription>
        </Alert>
      )}

      {isRejected && (
        <Card>
          <CardHeader>
            <CardTitle>Application rejected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {status?.statusMeta?.rejectionReason ?? "Your last application was rejected."}
            </p>
            <Button onClick={() => void restartApplication()}>Start new application</Button>
          </CardContent>
        </Card>
      )}
      </div>
      <DashboardFooter active="more" onChange={handleTabChange} />
    </div>
  );
}
