"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { toast } from "react-toastify";
import { LiveMerchantDashboard } from "./LiveMerchantDashboard";

const CITY_SLUG = "tcoin";

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

  const [status, setStatus] = useState<MerchantApplicationStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [biaOptions, setBiaOptions] = useState<BiaRecord[]>([]);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{ available: boolean; checkedSlug: string } | null>(null);

  const appState = status?.state ?? "none";
  const isDraft = appState === "draft";
  const isPending = appState === "pending";
  const isRejected = appState === "rejected";
  const isLive = appState === "live";

  const storeId = status?.storeId ?? null;

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
  }, []);

  const loadStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const next = await fetchJson<MerchantApplicationStatusResponse>(
        `/api/merchant/application/status?citySlug=${CITY_SLUG}`
      );
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
        const response = await fetchJson<{ bias?: BiaRecord[] }>(`/api/bias/list?citySlug=${CITY_SLUG}`);
        setBiaOptions(Array.isArray(response.bias) ? response.bias : []);
      } catch {
        setBiaOptions([]);
      }
    };

    void loadBiaOptions();
  }, [showWizard, wizardStep]);

  const startApplication = async (forceNew: boolean) => {
    try {
      const response = await fetchJson<{ signupStep?: number }>("/api/merchant/application/start", {
        method: "POST",
        body: JSON.stringify({ citySlug: CITY_SLUG, forceNew }),
      });
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
      const response = await fetchJson<{ signupStep?: number }>("/api/merchant/application/restart", {
        method: "POST",
        body: JSON.stringify({ citySlug: CITY_SLUG }),
      });
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
      toast.success("Address matched successfully.");
    } catch (geoError) {
      toast.error(geoError instanceof Error ? geoError.message : "Could not geocode that address.");
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

  const saveCurrentStep = async () => {
    if (!storeId) {
      toast.error("No draft application found to save.");
      return false;
    }

    setIsSavingStep(true);
    try {
      await fetchJson("/api/merchant/application/step", {
        method: "POST",
        body: JSON.stringify({
          citySlug: CITY_SLUG,
          storeId,
          step: wizardStep,
          payload: currentStepPayload,
        }),
      });
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

      await fetchJson("/api/merchant/application/submit", {
        method: "POST",
        body: JSON.stringify({ citySlug: CITY_SLUG, storeId }),
      });
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
    return <div className="p-6 text-sm">Error loading user data: {error.message}</div>;
  }

  if (isLoadingUser || isLoadingStatus) {
    return <div className="p-6 text-sm">Loading merchant workspace…</div>;
  }

  if (isLive) {
    return <LiveMerchantDashboard />;
  }

  return (
    <div className="p-6 space-y-6">
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
                  Merchants are expected to keep profile details accurate, follow city settlement policy, and maintain
                  redeemable operations when approved.
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
                <Input
                  placeholder="Logo image URL"
                  value={form.logoUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                />
                <Input
                  placeholder="Banner image URL"
                  value={form.bannerUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, bannerUrl: event.target.value }))}
                />
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Business address"
                  value={form.addressText}
                  onChange={(event) => setForm((prev) => ({ ...prev, addressText: event.target.value }))}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Latitude"
                    value={form.lat}
                    onChange={(event) => setForm((prev) => ({ ...prev, lat: event.target.value }))}
                  />
                  <Input
                    placeholder="Longitude"
                    value={form.lng}
                    onChange={(event) => setForm((prev) => ({ ...prev, lng: event.target.value }))}
                  />
                </div>
                <Button variant="outline" onClick={() => void lookupAddress()}>
                  Geocode address
                </Button>
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
                    setForm((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }));
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
              <Button
                variant="outline"
                onClick={() => setWizardStep((prev) => Math.max(1, prev - 1))}
                disabled={wizardStep <= 1 || isSavingStep || isSubmitting}
              >
                Back
              </Button>
              {wizardStep < 5 ? (
                <Button onClick={() => void nextStep()} disabled={isSavingStep || isSubmitting}>
                  {isSavingStep ? "Saving…" : "Save and continue"}
                </Button>
              ) : (
                <Button onClick={() => void submitApplication()} disabled={isSavingStep || isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Submit application"}
                </Button>
              )}
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
  );
}
