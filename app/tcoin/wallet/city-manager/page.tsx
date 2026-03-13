"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { Badge } from "@shared/components/ui/badge";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/Select";
import { Textarea } from "@shared/components/ui/TextArea";
import type { CityManagerStoreApplicationRecord, StoreLifecycleStatus } from "@shared/lib/merchantSignup/types";
import { toast } from "react-toastify";

const CITY_SLUG = "tcoin";

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

const statusLabel: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  live: "Live",
  rejected: "Rejected",
};

export default function CityManagerPage() {
  const { isLoadingUser, error } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StoreLifecycleStatus>("pending");
  const [stores, setStores] = useState<CityManagerStoreApplicationRecord[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [isMutating, setIsMutating] = useState<Record<number, boolean>>({});

  const loadStores = useCallback(async () => {
    setIsLoadingStores(true);
    setLoadError(null);
    try {
      const body = await fetchJson<{ stores?: CityManagerStoreApplicationRecord[] }>(
        `/api/city-manager/stores?citySlug=${CITY_SLUG}&status=${statusFilter}&limit=100`
      );
      setStores(Array.isArray(body.stores) ? body.stores : []);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : "Failed to load city-manager store list.");
      setStores([]);
    } finally {
      setIsLoadingStores(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!isLoadingUser) {
      void loadStores();
    }
  }, [isLoadingUser, loadStores]);

  const approveStore = async (storeId: number) => {
    setIsMutating((prev) => ({ ...prev, [storeId]: true }));
    try {
      await fetchJson(`/api/city-manager/stores/${storeId}/approve`, {
        method: "POST",
        body: JSON.stringify({ citySlug: CITY_SLUG }),
      });
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
      await fetchJson(`/api/city-manager/stores/${storeId}/reject`, {
        method: "POST",
        body: JSON.stringify({ citySlug: CITY_SLUG, reason }),
      });
      toast.success(`Store ${storeId} rejected.`);
      await loadStores();
    } catch (rejectError) {
      toast.error(rejectError instanceof Error ? rejectError.message : "Could not reject store.");
    } finally {
      setIsMutating((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  if (error) {
    return <div className="p-6 text-sm">Error loading user data: {error.message}</div>;
  }

  if (isLoadingUser) {
    return <div className="p-6 text-sm">Loading city-manager workspace…</div>;
  }

  return (
    <div className="p-6 space-y-6">
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
  );
}
