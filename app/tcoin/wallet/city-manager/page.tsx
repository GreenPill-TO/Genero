"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlPlaneAccess } from "@shared/api/hooks/useControlPlaneAccess";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Badge } from "@shared/components/ui/badge";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/Select";
import { Textarea } from "@shared/components/ui/TextArea";
import type { CityManagerStoreApplicationRecord, StoreLifecycleStatus } from "@shared/lib/merchantSignup/types";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import {
  WalletPageIntro,
  walletPageClass,
  walletPanelMutedClass,
  walletRailPageClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { LuUser } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  approveCityManagerStore,
  getCityManagerStores,
  rejectCityManagerStore,
} from "@shared/lib/edge/storeOperationsClient";
import { cn } from "@shared/utils/classnames";

const CITY_SLUG = "tcoin";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  live: "Live",
  rejected: "Rejected",
};

function formatAccountAge(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return "Unknown";
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - createdAt.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const absolute = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(createdAt);

  if (diffDays < 1) {
    return `Joined ${absolute} (today)`;
  }
  if (diffDays === 1) {
    return `Joined ${absolute} (1 day ago)`;
  }
  if (diffDays < 30) {
    return `Joined ${absolute} (${diffDays} days ago)`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `Joined ${absolute} (${diffMonths} month${diffMonths === 1 ? "" : "s"} ago)`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `Joined ${absolute} (${diffYears} year${diffYears === 1 ? "" : "s"} ago)`;
}

function ApplicantDetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 border-t border-white/10 py-3 first:border-t-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <p className={walletSectionLabelClass}>{label}</p>
      <p className="text-sm leading-6 text-foreground/90 break-words">{value && value.trim() ? value : "Not provided"}</p>
    </div>
  );
}

export default function CityManagerPage() {
  const { isLoadingUser, error } = useAuth();
  const router = useRouter();
  const controlPlaneAccess = useControlPlaneAccess(CITY_SLUG, !isLoadingUser);
  const [statusFilter, setStatusFilter] = useState<StoreLifecycleStatus>("pending");
  const [stores, setStores] = useState<CityManagerStoreApplicationRecord[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [isMutating, setIsMutating] = useState<Record<number, boolean>>({});
  const [selectedApplicant, setSelectedApplicant] = useState<CityManagerStoreApplicationRecord["applicant"] | null>(null);

  const canAccessCityManager = controlPlaneAccess.data?.canAccessCityManager === true;
  const accessError = controlPlaneAccess.error instanceof Error ? controlPlaneAccess.error.message : null;

  const loadStores = useCallback(async () => {
    if (!canAccessCityManager) {
      setStores([]);
      setLoadError("Forbidden: admin/operator role required.");
      return;
    }

    setIsLoadingStores(true);
    setLoadError(null);
    try {
      const body = await getCityManagerStores({
        status: statusFilter,
        limit: 100,
        appContext: { citySlug: CITY_SLUG },
      });
      setStores(Array.isArray(body.stores) ? body.stores : []);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : "Failed to load city-manager store list.");
      setStores([]);
    } finally {
      setIsLoadingStores(false);
    }
  }, [canAccessCityManager, statusFilter]);

  useEffect(() => {
    if (!isLoadingUser && !controlPlaneAccess.isLoading && canAccessCityManager) {
      void loadStores();
    }
  }, [canAccessCityManager, controlPlaneAccess.isLoading, isLoadingUser, loadStores]);

  useEffect(() => {
    if (isLoadingUser || controlPlaneAccess.isLoading) {
      return;
    }

    if (accessError === "Unauthorized" || (!accessError && !canAccessCityManager)) {
      router.replace("/dashboard");
    }
  }, [accessError, canAccessCityManager, controlPlaneAccess.isLoading, isLoadingUser, router]);

  const approveStore = async (storeId: number) => {
    setIsMutating((prev) => ({ ...prev, [storeId]: true }));
    try {
      await approveCityManagerStore(storeId, {}, { citySlug: CITY_SLUG });
      toast.success(`Store ${storeId} approved.`);
      await loadStores();
    } catch (approveError) {
      toast.error(approveError instanceof Error ? approveError.message : "Could not approve store.");
    } finally {
      setIsMutating((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  const rejectStore = async (storeId: number) => {
    const reason = (rejectReasons[storeId] ?? "").trim();
    if (!reason) {
      toast.error("A rejection reason is required.");
      return;
    }

    setIsMutating((prev) => ({ ...prev, [storeId]: true }));
    try {
      await rejectCityManagerStore(storeId, { reason }, { citySlug: CITY_SLUG });
      toast.success(`Store ${storeId} rejected.`);
      await loadStores();
    } catch (rejectError) {
      toast.error(rejectError instanceof Error ? rejectError.message : "Could not reject store.");
    } finally {
      setIsMutating((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  const mainClass = cn(walletPageClass, walletRailPageClass, "font-sans min-h-screen text-foreground");

  const handleTabChange = (next: string) => {
    if (next === "home") {
      router.push("/dashboard");
      return;
    }
    router.push(`/dashboard?tab=${encodeURIComponent(next)}`);
  };

  if (error) {
    return (
      <div className={mainClass}>
        <div className="text-sm">Error loading user data: {error.message}</div>
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  if (isLoadingUser || controlPlaneAccess.isLoading) {
    return (
      <div className={mainClass}>
        <div className="text-sm">Loading city-manager workspace…</div>
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  if (accessError && accessError !== "Unauthorized") {
    return (
      <div className={mainClass}>
        <Alert variant="destructive">
          <AlertTitle>Could not verify access</AlertTitle>
          <AlertDescription>{accessError}</AlertDescription>
        </Alert>
        <DashboardFooter active="more" onChange={handleTabChange} />
      </div>
    );
  }

  return (
    <div className={mainClass}>
      <div className="space-y-6">
        <WalletPageIntro
          eyebrow="Operator workspace"
          title="City Manager"
          description="Review merchant applications, keep approvals moving, and give clear reasons when a store needs follow-up."
          actions={(
            <Button variant="outline" className="rounded-full" onClick={() => router.push("/dashboard?tab=more")}>
              Back to More
            </Button>
          )}
        />
        <div className={`${walletPanelMutedClass} flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{statusLabel[statusFilter] ?? statusFilter}</span> applications for this city.
          </p>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StoreLifecycleStatus)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void loadStores()} disabled={isLoadingStores}>
              {isLoadingStores ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load applications</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {stores.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No stores found for this status.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => {
              const rowBusy = isMutating[store.storeId] === true;
              return (
                <Card key={store.storeId}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span>{store.profile?.displayName ?? `Store ${store.storeId}`}</span>
                      <Badge variant="outline">{statusLabel[store.lifecycleStatus] ?? store.lifecycleStatus}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Slug: {store.profile?.slug ?? "n/a"}</p>
                    <p className="text-sm text-muted-foreground">BIA: {store.bia ? `${store.bia.code} · ${store.bia.name}` : "n/a"}</p>
                    <p className="text-sm text-muted-foreground">Address: {store.profile?.addressText ?? "n/a"}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>Applicant:</span>
                      {store.applicant ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-slate-300/70 bg-slate-50/90 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.055] dark:hover:bg-white/[0.09]"
                          onClick={() => setSelectedApplicant(store.applicant)}
                        >
                          {store.applicant.fullName ?? store.applicant.username ?? store.applicant.email ?? "View applicant"}
                        </button>
                      ) : (
                        <span>n/a</span>
                      )}
                    </div>
                    {store.rejectionReason && (
                      <Alert>
                        <AlertTitle>Rejection reason</AlertTitle>
                        <AlertDescription>{store.rejectionReason}</AlertDescription>
                      </Alert>
                    )}
                    {store.lifecycleStatus === "pending" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Rejection reason (required for reject action)"
                          value={rejectReasons[store.storeId] ?? ""}
                          onChange={(event) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [store.storeId]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void approveStore(store.storeId)} disabled={rowBusy}>
                            Approve
                          </Button>
                          <Button variant="outline" onClick={() => void rejectStore(store.storeId)} disabled={rowBusy}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Dialog open={selectedApplicant != null} onOpenChange={(open) => (!open ? setSelectedApplicant(null) : undefined)}>
        <DialogContent className="max-w-2xl border-slate-200/70 bg-white/96 p-0 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/96">
          {selectedApplicant ? (
            <div className="space-y-0">
              <DialogHeader className="border-b border-slate-200/70 px-6 py-5 text-left dark:border-white/10">
                <div className="flex items-start gap-4 pr-8">
                  <Avatar className="h-16 w-16 border border-slate-200/80 shadow-sm dark:border-white/10">
                    {selectedApplicant.profileImageUrl ? (
                      <AvatarImage src={selectedApplicant.profileImageUrl} alt={selectedApplicant.fullName ?? "Applicant"} />
                    ) : (
                      <AvatarFallback>
                        <LuUser />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="space-y-1">
                    <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                      Applicant profile
                    </span>
                    <DialogTitle className="text-2xl font-semibold tracking-tight">
                      {selectedApplicant.fullName ?? selectedApplicant.username ?? selectedApplicant.email ?? "Applicant details"}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6">
                      Review the submitted account identity before approving merchant access.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5">
                <div className={`${walletPanelMutedClass} rounded-none border-0 bg-transparent px-0 py-0 shadow-none dark:bg-transparent`}>
                  <ApplicantDetailRow label="Full name" value={selectedApplicant.fullName} />
                  <ApplicantDetailRow label="Username" value={selectedApplicant.username ? `@${selectedApplicant.username}` : null} />
                  <ApplicantDetailRow label="Email" value={selectedApplicant.email} />
                  <ApplicantDetailRow label="Account age" value={formatAccountAge(selectedApplicant.createdAt)} />
                  <ApplicantDetailRow label="Country" value={selectedApplicant.country} />
                  <ApplicantDetailRow label="Phone" value={selectedApplicant.phone} />
                  <ApplicantDetailRow label="Address" value={selectedApplicant.address} />
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <DashboardFooter active="more" onChange={handleTabChange} />
    </div>
  );
}
