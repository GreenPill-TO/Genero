"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlPlaneAccess } from "@shared/api/hooks/useControlPlaneAccess";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { Badge } from "@shared/components/ui/badge";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/Select";
import { Textarea } from "@shared/components/ui/TextArea";
import type { CityManagerStoreApplicationRecord, StoreLifecycleStatus } from "@shared/lib/merchantSignup/types";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  approveCityManagerStore,
  getCityManagerStores,
  rejectCityManagerStore,
} from "@shared/lib/edge/storeOperationsClient";

const CITY_SLUG = "tcoin";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  live: "Live",
  rejected: "Rejected",
};

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

  const mainClass = "font-sans pb-24 p-4 sm:p-8 lg:pb-8 lg:pl-28 bg-background text-foreground min-h-screen";

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">City Manager</h1>
            <p className="text-sm text-muted-foreground">Review and approve merchant applications.</p>
          </div>
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
                    <p className="text-sm text-muted-foreground">Applicant: {store.applicant?.fullName ?? "n/a"}</p>
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
      <DashboardFooter active="more" onChange={handleTabChange} />
    </div>
  );
}
