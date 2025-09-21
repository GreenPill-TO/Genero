"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useRouter } from "next/navigation";
import { createClient } from "@shared/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { Badge } from "@shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/Select";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert";
import { toast } from "react-toastify";
import { hasAdminAccess } from "@shared/utils/access";

type OnRampRequest = {
  id: number;
  createdAt: string | null;
  amount: number | null;
  amountOverride: number | null;
  status: string | null;
  adminNotes: string | null;
  bankReference: string | null;
  interacCode: string | null;
  isSent: boolean | null;
  approvedTimestamp: string | null;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
};

type OffRampStatus = "initiated" | "completed" | "failed" | "aborted" | "burned";

type OffRampRequest = {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  cadToUser: number | null;
  tokensBurned: number | null;
  exchangeRate: number | null;
  cadOffRampFee: number | null;
  adminNotes: string | null;
  bankReferenceNumber: string | null;
  status: OffRampStatus;
  interacTarget: string | null;
  walletAccount: string | null;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
};

type OnRampEditState = {
  status: string | null;
  adminNotes: string;
  bankReference: string;
  amountOverride: string;
};

type OffRampEditState = {
  status: OffRampStatus;
  adminNotes: string;
  bankReferenceNumber: string;
  cadOffRampFee: string;
};

const OFF_RAMP_STATUSES: OffRampStatus[] = [
  "initiated",
  "completed",
  "failed",
  "aborted",
  "burned",
];

const normaliseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normaliseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "t", "1", "yes"].includes(lower)) {
      return true;
    }
    if (["false", "f", "0", "no"].includes(lower)) {
      return false;
    }
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const normaliseString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
};

const extractUserInfo = (raw: unknown): { name: string | null; email: string | null } => {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") {
    return { name: null, email: null };
  }

  const record = row as Record<string, unknown>;
  const name = normaliseString(record.full_name) ?? normaliseString(record.username);
  const email = normaliseString(record.email);

  return { name, email };
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "Unknown";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Unknown";
  return new Date(timestamp).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const tokenFormatter = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

const getBadgeVariant = (
  status: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" => {
  if (!status) return "outline";
  const normalised = status.toLowerCase();
  if (["completed", "approved", "settled"].includes(normalised)) {
    return "secondary";
  }
  if (["failed", "aborted", "burned", "rejected"].includes(normalised)) {
    return "destructive";
  }
  return "outline";
};

const parseAmountInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid number");
  }
  return parsed;
};

export default function AdminDashboardPage() {
  const { userData, isLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isMountedRef = useRef(true);

  const [onRampRequests, setOnRampRequests] = useState<OnRampRequest[]>([]);
  const [offRampRequests, setOffRampRequests] = useState<OffRampRequest[]>([]);
  const [onRampStatuses, setOnRampStatuses] = useState<string[]>([]);
  const [onRampEdits, setOnRampEdits] = useState<Record<number, OnRampEditState>>({});
  const [offRampEdits, setOffRampEdits] = useState<Record<number, OffRampEditState>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildOnRampEditState = useCallback((request: OnRampRequest): OnRampEditState => ({
    status: request.status ?? null,
    adminNotes: request.adminNotes ?? "",
    bankReference: request.bankReference ?? "",
    amountOverride:
      request.amountOverride != null && Number.isFinite(request.amountOverride)
        ? String(request.amountOverride)
        : "",
  }), []);

  const buildOffRampEditState = useCallback(
    (request: OffRampRequest): OffRampEditState => ({
      status: request.status,
      adminNotes: request.adminNotes ?? "",
      bankReferenceNumber: request.bankReferenceNumber ?? "",
      cadOffRampFee:
        request.cadOffRampFee != null && Number.isFinite(request.cadOffRampFee)
          ? String(request.cadOffRampFee)
          : "",
    }),
    []
  );

  useEffect(() => {
    setOnRampEdits(() => {
      const next: Record<number, OnRampEditState> = {};
      onRampRequests.forEach((request) => {
        next[request.id] = buildOnRampEditState(request);
      });
      return next;
    });
  }, [onRampRequests, buildOnRampEditState]);

  useEffect(() => {
    setOffRampEdits(() => {
      const next: Record<number, OffRampEditState> = {};
      offRampRequests.forEach((request) => {
        next[request.id] = buildOffRampEditState(request);
      });
      return next;
    });
  }, [offRampRequests, buildOffRampEditState]);

  const isAdmin = hasAdminAccess(
    userData?.cubidData?.is_admin ?? userData?.user?.is_admin
  );

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAdmin, router]);

  const loadRequests = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsFetching(true);
    setLoadError(null);

    try {
      const [onRampResult, offRampResult, statusResult] = await Promise.all([
        supabase
          .from("interac_transfer")
          .select(
            "id, created_at, amount, amount_override, status, admin_notes, bank_reference, interac_code, is_sent, approved_timestamp, user_id, users(full_name, email)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("off_ramp_req")
          .select(
            "id, created_at, updated_at, cad_to_user, tokens_burned, exchange_rate, cad_off_ramp_fee, admin_notes, bank_reference_number, status, interac_transfer_target, wallet_account, user_id, users(full_name, email)"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("ref_request_statuses")
          .select("status")
          .order("status", { ascending: true }),
      ]);

      if (onRampResult.error) throw onRampResult.error;
      if (offRampResult.error) throw offRampResult.error;
      if (statusResult.error) throw statusResult.error;

      const normalisedOnRamps: OnRampRequest[] = (onRampResult.data ?? []).map(
        (row: Record<string, unknown>) => {
          const { name, email } = extractUserInfo(row.users);
          return {
            id: Number(row.id) || 0,
            createdAt: normaliseString(row.created_at),
            amount: normaliseNumber(row.amount),
            amountOverride: normaliseNumber(row.amount_override),
            status: normaliseString(row.status),
            adminNotes: normaliseString(row.admin_notes),
            bankReference: normaliseString(row.bank_reference),
            interacCode: normaliseString(row.interac_code),
            isSent: normaliseBoolean(row.is_sent),
            approvedTimestamp: normaliseString(row.approved_timestamp),
            userId: Number(row.user_id) || null,
            userName: name,
            userEmail: email,
          };
        }
      );

      const normalisedOffRamps: OffRampRequest[] = (offRampResult.data ?? []).map(
        (row: Record<string, unknown>) => {
          const { name, email } = extractUserInfo(row.users);
          const status = normaliseString(row.status) as OffRampStatus | null;
          return {
            id: Number(row.id) || 0,
            createdAt: normaliseString(row.created_at),
            updatedAt: normaliseString(row.updated_at),
            cadToUser: normaliseNumber(row.cad_to_user),
            tokensBurned: normaliseNumber(row.tokens_burned),
            exchangeRate: normaliseNumber(row.exchange_rate),
            cadOffRampFee: normaliseNumber(row.cad_off_ramp_fee),
            adminNotes: normaliseString(row.admin_notes),
            bankReferenceNumber: normaliseString(row.bank_reference_number),
            status: status && OFF_RAMP_STATUSES.includes(status)
              ? status
              : "initiated",
            interacTarget: normaliseString(row.interac_transfer_target),
            walletAccount: normaliseString(row.wallet_account),
            userId: Number(row.user_id) || null,
            userName: name,
            userEmail: email,
          };
        }
      );

      const statusValues = (statusResult.data ?? [])
        .map((row: Record<string, unknown>) => normaliseString(row.status))
        .filter((value): value is string => Boolean(value));

      if (isMountedRef.current) {
        setOnRampRequests(normalisedOnRamps);
        setOffRampRequests(normalisedOffRamps);
        setOnRampStatuses(statusValues);
        setLastSyncedAt(new Date());
      }
    } catch (error) {
      console.error("Failed to load ramp requests", error);
      if (isMountedRef.current) {
        setLoadError("Unable to load the latest ramp requests. Please try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      void loadRequests();
    }
  }, [isLoading, isAdmin, loadRequests]);

  const availableOnRampStatuses = useMemo(() => {
    const derived = onRampRequests
      .map((request) => request.status)
      .filter((status): status is string => Boolean(status));
    const combined = [...onRampStatuses, ...derived];
    return Array.from(new Set(combined));
  }, [onRampRequests, onRampStatuses]);

  const totalOnRampVolume = useMemo(
    () =>
      onRampRequests.reduce((sum, request) => {
        const amount =
          request.amountOverride ?? request.amount ?? 0;
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [onRampRequests]
  );

  const totalOffRampVolume = useMemo(
    () =>
      offRampRequests.reduce((sum, request) => {
        const amount = request.cadToUser ?? 0;
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [offRampRequests]
  );

  const pendingOnRamps = useMemo(
    () =>
      onRampRequests.filter((request) => {
        if (!request.status) return true;
        return request.status.toLowerCase() !== "completed";
      }).length,
    [onRampRequests]
  );

  const pendingOffRamps = useMemo(
    () => offRampRequests.filter((request) => request.status === "initiated").length,
    [offRampRequests]
  );

  const updateOnRampEdit = (id: number, updates: Partial<OnRampEditState>) => {
    setOnRampEdits((prev) => {
      const requestRecord = onRampRequests.find((item) => item.id === id);
      if (!requestRecord) {
        return prev;
      }
      const current = prev[id] ?? buildOnRampEditState(requestRecord);
      return { ...prev, [id]: { ...current, ...updates } };
    });
  };

  const updateOffRampEdit = (id: number, updates: Partial<OffRampEditState>) => {
    setOffRampEdits((prev) => {
      const requestRecord = offRampRequests.find((item) => item.id === id);
      if (!requestRecord) {
        return prev;
      }
      const current = prev[id] ?? buildOffRampEditState(requestRecord);
      return { ...prev, [id]: { ...current, ...updates } };
    });
  };

  const resetOnRampEdit = (request: OnRampRequest) => {
    setOnRampEdits((prev) => ({
      ...prev,
      [request.id]: buildOnRampEditState(request),
    }));
  };

  const resetOffRampEdit = (request: OffRampRequest) => {
    setOffRampEdits((prev) => ({
      ...prev,
      [request.id]: buildOffRampEditState(request),
    }));
  };

  const hasOnRampChanges = (request: OnRampRequest, edit: OnRampEditState | undefined) => {
    if (!edit) return false;
    const base = buildOnRampEditState(request);
    return (
      base.status !== edit.status ||
      (base.adminNotes ?? "") !== (edit.adminNotes ?? "") ||
      (base.bankReference ?? "") !== (edit.bankReference ?? "") ||
      (base.amountOverride ?? "") !== (edit.amountOverride ?? "")
    );
  };

  const hasOffRampChanges = (request: OffRampRequest, edit: OffRampEditState | undefined) => {
    if (!edit) return false;
    const base = buildOffRampEditState(request);
    return (
      base.status !== edit.status ||
      (base.adminNotes ?? "") !== (edit.adminNotes ?? "") ||
      (base.bankReferenceNumber ?? "") !== (edit.bankReferenceNumber ?? "") ||
      (base.cadOffRampFee ?? "") !== (edit.cadOffRampFee ?? "")
    );
  };

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

  const handleOnRampSave = async (request: OnRampRequest) => {
    const edit = onRampEdits[request.id];
    if (!edit) return;

    let parsedOverride: number | null;
    try {
      parsedOverride = parseAmountInput(edit.amountOverride);
    } catch (error) {
      toast.error("Enter a valid override amount for the on-ramp request.");
      return;
    }

    const payload: Record<string, unknown> = {
      admin_notes: edit.adminNotes.trim() === "" ? null : edit.adminNotes.trim(),
      bank_reference: edit.bankReference.trim() === "" ? null : edit.bankReference.trim(),
      amount_override: parsedOverride,
      status: edit.status,
    };

    const key = `on-${request.id}`;
    markSaving(key);

    try {
      const { error } = await supabase
        .from("interac_transfer")
        .update(payload)
        .eq("id", request.id);

      if (error) throw error;

      toast.success(`On-ramp request #${request.id} updated.`);
      await loadRequests();
    } catch (error) {
      console.error("Failed to update on-ramp request", error);
      toast.error("Could not update the on-ramp request. Please try again.");
    } finally {
      clearSaving(key);
    }
  };

  const handleOffRampSave = async (request: OffRampRequest) => {
    const edit = offRampEdits[request.id];
    if (!edit) return;

    let parsedFee: number | null;
    try {
      parsedFee = parseAmountInput(edit.cadOffRampFee);
    } catch (error) {
      toast.error("Enter a valid CAD fee for the off-ramp request.");
      return;
    }

    const payload: Record<string, unknown> = {
      admin_notes: edit.adminNotes.trim() === "" ? null : edit.adminNotes.trim(),
      bank_reference_number:
        edit.bankReferenceNumber.trim() === "" ? null : edit.bankReferenceNumber.trim(),
      cad_off_ramp_fee: parsedFee,
      status: edit.status,
    };

    const key = `off-${request.id}`;
    markSaving(key);

    try {
      const { error } = await supabase
        .from("off_ramp_req")
        .update(payload)
        .eq("id", request.id);

      if (error) throw error;

      toast.success(`Off-ramp request #${request.id} updated.`);
      await loadRequests();
    } catch (error) {
      console.error("Failed to update off-ramp request", error);
      toast.error("Could not update the off-ramp request. Please try again.");
    } finally {
      clearSaving(key);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm">Checking admin permissions…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Restricted area</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You need administrator privileges to view the management dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const adminName =
    normaliseString(userData?.cubidData?.full_name) ??
    normaliseString(userData?.cubidData?.nickname);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review on-ramp and off-ramp activity, leave notes for the operations team and update request statuses.
          </p>
          {adminName && (
            <p className="mt-1 text-xs text-muted-foreground">Signed in as {adminName}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Synced {lastSyncedAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button onClick={() => void loadRequests()} disabled={isFetching} variant="outline">
            {isFetching ? "Refreshing…" : "Refresh data"}
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load requests</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On-ramp requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{onRampRequests.length}</p>
            <p className="text-xs text-muted-foreground">{pendingOnRamps} awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Off-ramp requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{offRampRequests.length}</p>
            <p className="text-xs text-muted-foreground">{pendingOffRamps} in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total on-ramp volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{tokenFormatter.format(totalOnRampVolume)} TCOIN</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total off-ramp CAD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{cadFormatter.format(totalOffRampVolume)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>On-ramp requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {onRampRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No on-ramp requests have been recorded yet.
            </p>
          ) : (
            onRampRequests.map((request) => {
              const edit = onRampEdits[request.id];
              const hasChanges = hasOnRampChanges(request, edit);
              const isSaving = pendingUpdates[`on-${request.id}`] === true;

              return (
                <div key={request.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Request #{request.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</p>
                      {request.userName && (
                        <p className="mt-2 text-sm">
                          {request.userName}
                          {request.userEmail && (
                            <span className="text-muted-foreground"> · {request.userEmail}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <Badge variant={getBadgeVariant(request.status)}>
                      {request.status ?? "Unassigned"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Requested amount
                      </p>
                      <p className="text-sm">
                        {tokenFormatter.format(request.amount ?? 0)} TCOIN
                      </p>
                      {request.amountOverride != null && (
                        <p className="text-xs text-muted-foreground">
                          Override: {tokenFormatter.format(request.amountOverride)} TCOIN
                        </p>
                      )}
                      {request.isSent && (
                        <p className="text-xs text-muted-foreground">Member confirmed the transfer was sent.</p>
                      )}
                      {request.approvedTimestamp && (
                        <p className="text-xs text-muted-foreground">
                          Marked as approved {formatDateTime(request.approvedTimestamp)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Interac reference
                      </p>
                      <p className="text-sm">{request.interacCode ?? "Not provided"}</p>
                      {request.bankReference && (
                        <p className="text-xs text-muted-foreground">
                          Bank reference · {request.bankReference}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </label>
                      <Select
                        value={edit?.status ?? undefined}
                        onValueChange={(value) => updateOnRampEdit(request.id, { status: value })}
                      >
                        <SelectTrigger aria-label={`Status for on-ramp request ${request.id}`}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOnRampStatuses.length === 0 && (
                            <SelectItem value="completed">completed</SelectItem>
                          )}
                          {availableOnRampStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Bank reference number
                      </label>
                      <Input
                        value={edit?.bankReference ?? ""}
                        onChange={(event) =>
                          updateOnRampEdit(request.id, { bankReference: event.target.value })
                        }
                        placeholder="Add a bank reference number"
                        aria-label={`Bank reference number for on-ramp request ${request.id}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Override amount (TCOIN)
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={edit?.amountOverride ?? ""}
                        onChange={(event) =>
                          updateOnRampEdit(request.id, { amountOverride: event.target.value })
                        }
                        placeholder="Leave blank to honour the requested amount"
                        aria-label={`Override amount for on-ramp request ${request.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to apply the wallet holder’s original amount.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Internal notes
                      </label>
                      <Textarea
                        rows={3}
                        value={edit?.adminNotes ?? ""}
                        onChange={(event) =>
                          updateOnRampEdit(request.id, { adminNotes: event.target.value })
                        }
                        placeholder="Record context for the operations team"
                        aria-label={`Internal notes for on-ramp request ${request.id}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetOnRampEdit(request)}
                      disabled={!hasChanges || isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleOnRampSave(request)}
                      disabled={!hasChanges || isSaving}
                    >
                      {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Off-ramp requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {offRampRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No off-ramp requests are waiting for review.
            </p>
          ) : (
            offRampRequests.map((request) => {
              const edit = offRampEdits[request.id];
              const hasChanges = hasOffRampChanges(request, edit);
              const isSaving = pendingUpdates[`off-${request.id}`] === true;

              return (
                <div key={request.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Request #{request.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</p>
                      {request.userName && (
                        <p className="mt-2 text-sm">
                          {request.userName}
                          {request.userEmail && (
                            <span className="text-muted-foreground"> · {request.userEmail}</span>
                          )}
                        </p>
                      )}
                      {request.interacTarget && (
                        <p className="text-xs text-muted-foreground">
                          eTransfer to {request.interacTarget}
                        </p>
                      )}
                    </div>
                    <Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        CAD to send
                      </p>
                      <p className="text-sm">{cadFormatter.format(request.cadToUser ?? 0)}</p>
                      {request.tokensBurned != null && (
                        <p className="text-xs text-muted-foreground">
                          {tokenFormatter.format(request.tokensBurned)} TCOIN burned
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Wallet account
                      </p>
                      <p className="text-sm break-words">
                        {request.walletAccount ?? "Not recorded"}
                      </p>
                      {request.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDateTime(request.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </label>
                      <Select
                        value={edit?.status ?? "initiated"}
                        onValueChange={(value) =>
                          updateOffRampEdit(request.id, {
                            status: value as OffRampStatus,
                          })
                        }
                      >
                        <SelectTrigger aria-label={`Status for off-ramp request ${request.id}`}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {OFF_RAMP_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Bank reference number
                      </label>
                      <Input
                        value={edit?.bankReferenceNumber ?? ""}
                        onChange={(event) =>
                          updateOffRampEdit(request.id, {
                            bankReferenceNumber: event.target.value,
                          })
                        }
                        placeholder="Add a bank reference number"
                        aria-label={`Bank reference number for off-ramp request ${request.id}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        CAD fee applied
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={edit?.cadOffRampFee ?? ""}
                        onChange={(event) =>
                          updateOffRampEdit(request.id, {
                            cadOffRampFee: event.target.value,
                          })
                        }
                        placeholder="Leave blank if no fee was charged"
                        aria-label={`CAD fee for off-ramp request ${request.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Provide the amount charged to cover banking costs.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Internal notes
                      </label>
                      <Textarea
                        rows={3}
                        value={edit?.adminNotes ?? ""}
                        onChange={(event) =>
                          updateOffRampEdit(request.id, { adminNotes: event.target.value })
                        }
                        placeholder="Record payout instructions or follow-ups"
                        aria-label={`Internal notes for off-ramp request ${request.id}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetOffRampEdit(request)}
                      disabled={!hasChanges || isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleOffRampSave(request)}
                      disabled={!hasChanges || isSaving}
                    >
                      {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
