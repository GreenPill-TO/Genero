"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/Select";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { Badge } from "@shared/components/ui/badge";
import { toast } from "react-toastify";

const CITY_SLUG = "tcoin";
const bypassAuthInLocalDev = ["local", "development"].includes(
  (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase()
);

type BiaRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type RedemptionRequestRecord = {
  id: string | number;
  status: string;
  token_amount: number | null;
  settlement_amount: number | null;
  settlement_asset: string | null;
  created_at: string | null;
  updated_at: string | null;
  bia: { id: string; code: string; name: string } | null;
  storeProfile: { store_id: number; display_name: string | null; wallet_address: string | null } | null;
  settlements: Array<{
    id: string | number;
    status: string;
    settlement_amount: number | null;
    settlement_asset: string | null;
    created_at: string | null;
  }>;
};

type GovernanceActionRecord = {
  id: string | number;
  action_type: string;
  reason: string | null;
  created_at: string | null;
};

type MerchantVoucherLiquidity = {
  merchantStoreId: number;
  displayName?: string;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  voucherIssueLimit?: string | null;
  requiredLiquidityAbsolute?: string | null;
  requiredLiquidityRatio?: string | null;
  creditIssued?: string;
  creditRemaining?: string | null;
  sourceMode?: string;
  available: boolean;
};

type MerchantStoreForm = {
  storeId: string;
  displayName: string;
  walletAddress: string;
  addressText: string;
  lat: string;
  lng: string;
  biaId: string;
};

type RedemptionForm = {
  tokenAmount: string;
  settlementAmount: string;
  settlementAsset: string;
  notes: string;
};

const tokenFormatter = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatLiquiditySource = (value: string | undefined): string => {
  if (value === "contract_field") {
    return "sarafu_onchain";
  }
  return "derived_supply";
};

const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

const formatDateTime = (value: string | null): string => {
  if (!value) return "Unknown";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Unknown";
  return new Date(timestamp).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getBadgeVariant = (
  status: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" => {
  if (!status) return "outline";
  const normalized = status.toLowerCase();
  if (["completed", "approved", "settled", "submitted", "processing"].includes(normalized)) {
    return "secondary";
  }
  if (["failed", "aborted", "burned", "rejected"].includes(normalized)) {
    return "destructive";
  }
  return "outline";
};

const asApiErrorMessage = (status: number, body: unknown): string => {
  if (body && typeof body === "object" && "error" in body) {
    const candidate = (body as { error?: unknown }).error;
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }
  return `Request failed with status ${status}`;
};

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(asApiErrorMessage(response.status, body));
  }

  return body as T;
};

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { userData, isLoadingUser, error } = useAuth();

  const [bias, setBias] = useState<BiaRecord[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRequestRecord[]>([]);
  const [governanceActions, setGovernanceActions] = useState<GovernanceActionRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [voucherLiquidityRows, setVoucherLiquidityRows] = useState<MerchantVoucherLiquidity[]>([]);

  const [storeForm, setStoreForm] = useState<MerchantStoreForm>({
    storeId: "",
    displayName: "",
    walletAddress: "",
    addressText: "",
    lat: "",
    lng: "",
    biaId: "",
  });

  const [redemptionForm, setRedemptionForm] = useState<RedemptionForm>({
    tokenAmount: "",
    settlementAmount: "",
    settlementAsset: "CAD",
    notes: "",
  });

  const storeOptions = useMemo(() => {
    const byStoreId = new Map<number, { id: number; label: string; wallet: string | null }>();
    redemptions.forEach((request) => {
      const profile = request.storeProfile;
      if (!profile || !Number.isFinite(profile.store_id) || profile.store_id <= 0) {
        return;
      }
      if (!byStoreId.has(profile.store_id)) {
        byStoreId.set(profile.store_id, {
          id: profile.store_id,
          label: profile.display_name?.trim() || `Store ${profile.store_id}`,
          wallet: profile.wallet_address ?? null,
        });
      }
    });
    return Array.from(byStoreId.values()).sort((a, b) => a.id - b.id);
  }, [redemptions]);

  useEffect(() => {
    if (!isLoadingUser && !userData?.cubidData?.full_name && !bypassAuthInLocalDev) {
      router.replace("/");
    }
  }, [isLoadingUser, userData, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const cached = window.localStorage.getItem("tcoin_merchant_store_id");
    if (cached && /^\d+$/.test(cached)) {
      setStoreForm((prev) => ({ ...prev, storeId: cached }));
    }
  }, []);

  useEffect(() => {
    if (!storeForm.storeId && storeOptions.length > 0) {
      const first = String(storeOptions[0].id);
      setStoreForm((prev) => ({ ...prev, storeId: first }));
    }
  }, [storeOptions, storeForm.storeId]);

  const markSaving = (key: string) => {
    setPendingUpdates((prev) => ({ ...prev, [key]: true }));
  };

  const clearSaving = (key: string) => {
    setPendingUpdates((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setLoadError(null);

    try {
      const [biaResponse, redemptionResponse, governanceResponse, voucherMerchantsResponse] = await Promise.all([
        fetchJson<{ activeAffiliation?: { biaId?: string }; bias?: BiaRecord[] }>(
          `/api/bias/list?citySlug=${CITY_SLUG}`
        ),
        fetchJson<{ requests?: RedemptionRequestRecord[] }>(
          `/api/redemptions/list?citySlug=${CITY_SLUG}&limit=75`
        ),
        fetchJson<{ actions?: GovernanceActionRecord[] }>(
          `/api/governance/actions?citySlug=${CITY_SLUG}&limit=20`
        ),
        fetchJson<{ merchants?: MerchantVoucherLiquidity[] }>(
          `/api/vouchers/merchants?citySlug=${CITY_SLUG}&chainId=42220&scope=city`
        ),
      ]);

      const nextBias = biaResponse.bias ?? [];
      setBias(nextBias);
      setRedemptions(redemptionResponse.requests ?? []);
      setGovernanceActions(governanceResponse.actions ?? []);
      setVoucherLiquidityRows(voucherMerchantsResponse.merchants ?? []);
      setLastSyncedAt(new Date());

      if (!storeForm.biaId) {
        const preferredBiaId = biaResponse.activeAffiliation?.biaId ?? nextBias[0]?.id;
        if (preferredBiaId) {
          setStoreForm((prev) => ({ ...prev, biaId: preferredBiaId }));
        }
      }
    } catch (loadErr) {
      setLoadError(loadErr instanceof Error ? loadErr.message : "Failed to load merchant data.");
    } finally {
      setIsLoadingData(false);
    }
  }, [storeForm.biaId]);

  useEffect(() => {
    if (!isLoadingUser && (userData?.cubidData?.full_name || bypassAuthInLocalDev)) {
      void loadData();
    }
  }, [isLoadingUser, userData, loadData]);

  const handleSaveStore = async () => {
    const key = "save-store";
    markSaving(key);

    try {
      const parsedStoreId = Number.parseInt(storeForm.storeId, 10);
      const parsedLat = storeForm.lat.trim() === "" ? undefined : Number.parseFloat(storeForm.lat);
      const parsedLng = storeForm.lng.trim() === "" ? undefined : Number.parseFloat(storeForm.lng);

      if ((storeForm.lat.trim() !== "" && !Number.isFinite(parsedLat)) || (storeForm.lng.trim() !== "" && !Number.isFinite(parsedLng))) {
        throw new Error("Latitude and longitude must be numeric values.");
      }

      const response = await fetchJson<{ store?: { store_id?: number }; affiliation?: { bia_id?: string } }>(
        "/api/stores",
        {
          method: "POST",
          body: JSON.stringify({
            citySlug: CITY_SLUG,
            storeId: Number.isFinite(parsedStoreId) && parsedStoreId > 0 ? parsedStoreId : undefined,
            displayName: storeForm.displayName.trim() || undefined,
            walletAddress: storeForm.walletAddress.trim() || undefined,
            addressText: storeForm.addressText.trim() || undefined,
            lat: Number.isFinite(parsedLat) ? parsedLat : undefined,
            lng: Number.isFinite(parsedLng) ? parsedLng : undefined,
            biaId: storeForm.biaId || undefined,
            source: "merchant_selected",
            status: "active",
          }),
        }
      );

      const nextStoreId = Number(response.store?.store_id ?? parsedStoreId);
      if (Number.isFinite(nextStoreId) && nextStoreId > 0) {
        const nextStoreIdString = String(nextStoreId);
        setStoreForm((prev) => ({ ...prev, storeId: nextStoreIdString }));
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tcoin_merchant_store_id", nextStoreIdString);
        }
      }

      if (response.affiliation?.bia_id) {
        setStoreForm((prev) => ({ ...prev, biaId: response.affiliation?.bia_id ?? prev.biaId }));
      }

      toast.success("Store profile saved.");
      await loadData();
    } catch (saveErr) {
      toast.error(saveErr instanceof Error ? saveErr.message : "Could not save store profile.");
    } finally {
      clearSaving(key);
    }
  };

  const handleAssignStoreBia = async () => {
    const parsedStoreId = Number.parseInt(storeForm.storeId, 10);
    if (!Number.isFinite(parsedStoreId) || parsedStoreId <= 0) {
      toast.error("Set a valid store id before assigning a BIA.");
      return;
    }
    if (!storeForm.biaId) {
      toast.error("Select a BIA before assigning.");
      return;
    }

    const key = "assign-bia";
    markSaving(key);

    try {
      await fetchJson(`/api/stores/${parsedStoreId}/bia`, {
        method: "POST",
        body: JSON.stringify({
          citySlug: CITY_SLUG,
          biaId: storeForm.biaId,
          source: "merchant_selected",
        }),
      });
      toast.success("Store BIA assignment updated.");
      await loadData();
    } catch (assignErr) {
      toast.error(assignErr instanceof Error ? assignErr.message : "Could not update store BIA.");
    } finally {
      clearSaving(key);
    }
  };

  const handleCreateRedemption = async () => {
    const parsedStoreId = Number.parseInt(storeForm.storeId, 10);
    const tokenAmount = Number.parseFloat(redemptionForm.tokenAmount);
    const settlementAmount = Number.parseFloat(redemptionForm.settlementAmount);

    if (!Number.isFinite(parsedStoreId) || parsedStoreId <= 0) {
      toast.error("Set a valid store id before creating a redemption request.");
      return;
    }

    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      toast.error("Token amount must be a positive number.");
      return;
    }

    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      toast.error("Settlement amount must be a positive number.");
      return;
    }

    const key = "create-redemption";
    markSaving(key);

    try {
      await fetchJson("/api/redemptions/request", {
        method: "POST",
        body: JSON.stringify({
          citySlug: CITY_SLUG,
          storeId: parsedStoreId,
          chainId: 42220,
          tokenAmount,
          settlementAsset: redemptionForm.settlementAsset.trim() || "CAD",
          settlementAmount,
          metadata: {
            merchantNotes: redemptionForm.notes.trim() || null,
            source: "merchant_dashboard",
          },
        }),
      });

      toast.success("Redemption request submitted.");
      setRedemptionForm({
        tokenAmount: "",
        settlementAmount: "",
        settlementAsset: redemptionForm.settlementAsset,
        notes: "",
      });
      await loadData();
    } catch (requestErr) {
      toast.error(requestErr instanceof Error ? requestErr.message : "Could not create redemption request.");
    } finally {
      clearSaving(key);
    }
  };

  if (error) {
    return <div className="p-6 text-sm">Error loading user data: {error.message}</div>;
  }

  if (isLoadingUser) {
    return <div className="p-6 text-sm">Loading merchant workspace…</div>;
  }

  const pendingCount = redemptions.filter((request) => request.status === "pending").length;
  const settledCount = redemptions.filter((request) => request.status === "settled").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Merchant Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage store profile + BIA affiliation and submit/view redemption requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Synced {lastSyncedAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" onClick={() => void loadData()} disabled={isLoadingData}>
            {isLoadingData ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load merchant data</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Available BIAs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{bias.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Settled redemptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{settledCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Store Profile + BIA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Store ID (optional for new store)"
                value={storeForm.storeId}
                onChange={(event) => setStoreForm((prev) => ({ ...prev, storeId: event.target.value }))}
                aria-label="Store id"
              />
              <Select
                value={storeForm.biaId || undefined}
                onValueChange={(value) => setStoreForm((prev) => ({ ...prev, biaId: value }))}
              >
                <SelectTrigger aria-label="Store BIA">
                  <SelectValue placeholder="Select BIA" />
                </SelectTrigger>
                <SelectContent>
                  {bias.map((bia) => (
                    <SelectItem key={bia.id} value={bia.id}>
                      {bia.code} · {bia.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              placeholder="Store display name"
              value={storeForm.displayName}
              onChange={(event) => setStoreForm((prev) => ({ ...prev, displayName: event.target.value }))}
              aria-label="Store display name"
            />
            <Input
              placeholder="Store wallet address"
              value={storeForm.walletAddress}
              onChange={(event) => setStoreForm((prev) => ({ ...prev, walletAddress: event.target.value }))}
              aria-label="Store wallet address"
            />
            <Input
              placeholder="Store address"
              value={storeForm.addressText}
              onChange={(event) => setStoreForm((prev) => ({ ...prev, addressText: event.target.value }))}
              aria-label="Store address"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Latitude"
                value={storeForm.lat}
                onChange={(event) => setStoreForm((prev) => ({ ...prev, lat: event.target.value }))}
                aria-label="Store latitude"
              />
              <Input
                placeholder="Longitude"
                value={storeForm.lng}
                onChange={(event) => setStoreForm((prev) => ({ ...prev, lng: event.target.value }))}
                aria-label="Store longitude"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => void handleAssignStoreBia()}
                disabled={pendingUpdates["assign-bia"] === true}
              >
                {pendingUpdates["assign-bia"] ? "Assigning…" : "Assign BIA"}
              </Button>
              <Button onClick={() => void handleSaveStore()} disabled={pendingUpdates["save-store"] === true}>
                {pendingUpdates["save-store"] ? "Saving…" : "Save Store"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Redemption Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Token amount"
              value={redemptionForm.tokenAmount}
              onChange={(event) =>
                setRedemptionForm((prev) => ({ ...prev, tokenAmount: event.target.value }))
              }
              aria-label="Redemption token amount"
            />
            <Input
              placeholder="Settlement amount"
              value={redemptionForm.settlementAmount}
              onChange={(event) =>
                setRedemptionForm((prev) => ({ ...prev, settlementAmount: event.target.value }))
              }
              aria-label="Redemption settlement amount"
            />
            <Input
              placeholder="Settlement asset"
              value={redemptionForm.settlementAsset}
              onChange={(event) =>
                setRedemptionForm((prev) => ({ ...prev, settlementAsset: event.target.value }))
              }
              aria-label="Redemption settlement asset"
            />
            <Textarea
              rows={3}
              placeholder="Notes"
              value={redemptionForm.notes}
              onChange={(event) =>
                setRedemptionForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              aria-label="Redemption notes"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void handleCreateRedemption()}
                disabled={pendingUpdates["create-redemption"] === true}
              >
                {pendingUpdates["create-redemption"] ? "Submitting…" : "Submit Redemption"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Redemption Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemption requests yet.</p>
          ) : (
            redemptions.map((request) => (
              <div key={String(request.id)} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Request #{String(request.id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(request.created_at)} · {request.bia?.code ?? "Unknown BIA"}
                    </p>
                  </div>
                  <Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
                  <p>Token amount: {tokenFormatter.format(request.token_amount ?? 0)}</p>
                  <p>
                    Settlement: {request.settlement_amount != null ? cadFormatter.format(request.settlement_amount) : "n/a"}{" "}
                    {request.settlement_asset ?? ""}
                  </p>
                </div>
                {request.settlements?.length > 0 && (
                  <div className="mt-2 rounded-md bg-muted p-2 text-xs">
                    {request.settlements.map((settlement) => (
                      <p key={String(settlement.id)}>
                        {settlement.status} · {settlement.settlement_amount ?? "?"} {settlement.settlement_asset ?? ""} ·{" "}
                        {formatDateTime(settlement.created_at)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Governance / Operations Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {governanceActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent actions found.</p>
          ) : (
            governanceActions.map((action) => (
              <div key={String(action.id)} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{action.action_type}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(action.created_at)}</p>
                </div>
                {action.reason && <p className="text-muted-foreground">{action.reason}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {storeOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Known Store Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {storeOptions.map((store) => (
              <div key={store.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{store.label}</p>
                <p className="text-xs text-muted-foreground">Store ID {store.id}</p>
                {store.wallet && <p className="text-xs text-muted-foreground break-all">{store.wallet}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Voucher Liquidity + Credit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Voucher issuance and liquidity requirements come from Sarafu pool contracts and are shown read-only here.
          </p>
          {voucherLiquidityRows.filter((row) => row.merchantStoreId === Number.parseInt(storeForm.storeId, 10))
            .length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No voucher liquidity rows are indexed for this store yet.
            </p>
          ) : (
            voucherLiquidityRows
              .filter((row) => row.merchantStoreId === Number.parseInt(storeForm.storeId, 10))
              .map((row, index) => (
                <div
                  key={`${row.merchantStoreId}:${row.tokenAddress ?? "none"}:${index}`}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="font-medium">
                    {row.tokenSymbol ?? "Voucher"} {row.tokenName ? `· ${row.tokenName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    Pool: {row.poolAddress ?? "n/a"} · Token: {row.tokenAddress ?? "n/a"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Credit issued: {row.creditIssued ?? "0"} · Remaining: {row.creditRemaining ?? "n/a"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Voucher limit: {row.voucherIssueLimit ?? "null"} · liquidity abs:{" "}
                    {row.requiredLiquidityAbsolute ?? "null"} · liquidity ratio:{" "}
                    {row.requiredLiquidityRatio ?? "null"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source: {formatLiquiditySource(row.sourceMode)}
                  </p>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
