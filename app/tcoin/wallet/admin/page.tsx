"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlPlaneAccess } from "@shared/api/hooks/useControlPlaneAccess";
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

type BiaRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  center_lat: number | null;
  center_lng: number | null;
};

type BiaControlRecord = {
  bia_id: string;
  max_daily_redemption: number | null;
  max_tx_amount: number | null;
  queue_only_mode: boolean;
  is_frozen: boolean;
  updated_at: string | null;
};

type RedemptionRequestRecord = {
  id: string | number;
  status: string;
  token_amount: number | null;
  settlement_amount: number | null;
  settlement_asset: string | null;
  pool_address: string | null;
  tx_hash: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  bia: { id: string; code: string; name: string } | null;
  storeProfile: { store_id: number; display_name: string | null; wallet_address: string | null } | null;
  settlements: Array<{
    id: string | number;
    status: string;
    tx_hash: string | null;
    settlement_amount: number | null;
    settlement_asset: string | null;
    created_at: string | null;
  }>;
};

type GovernanceActionRecord = {
  id: string | number;
  action_type: string;
  reason: string | null;
  store_id: number | null;
  bia_id: string | null;
  created_at: string | null;
  payload?: Record<string, unknown> | null;
};

type VoucherCompatibilityRule = {
  id: string;
  city_slug: string;
  chain_id: number;
  pool_address: string;
  token_address: string;
  merchant_store_id: number | null;
  accepted_by_default: boolean;
  rule_status: string;
  updated_at: string | null;
};

type MerchantVoucherLiquidity = {
  merchantStoreId: number;
  displayName?: string;
  walletAddress?: string;
  biaCode?: string;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  voucherIssueLimit?: string | null;
  requiredLiquidityAbsolute?: string | null;
  requiredLiquidityRatio?: string | null;
  creditIssued?: string;
  creditRemaining?: string | null;
  sourceMode?: string;
  available: boolean;
};

type OnrampCheckoutSessionSummary = {
  id: string;
  userId: number;
  provider: string;
  fiatAmount: string;
  fiatCurrency: string;
  status: string;
  statusReason: string | null;
  depositAddress: string;
  recipientWallet: string;
  incomingUsdcTxHash: string | null;
  mintTxHash: string | null;
  tcoinOutAmount: string | null;
  latestAttemptNo: number | null;
  latestAttemptMode: string | null;
  latestAttemptState: string | null;
  latestAttemptError: string | null;
  createdAt: string;
  updatedAt: string;
};

type SettlementDraft = {
  settlementAmount: string;
  settlementAsset: string;
  txHash: string;
  notes: string;
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

const formatLiquiditySource = (value: string | undefined): string => {
  if (value === "contract_field") {
    return "sarafu_onchain";
  }
  return "derived_supply";
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

export default function AdminDashboardPage() {
  const { userData, isLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const controlPlaneAccess = useControlPlaneAccess("tcoin", !isLoading);
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
  const [biaRecords, setBiaRecords] = useState<BiaRecord[]>([]);
  const [biaControls, setBiaControls] = useState<BiaControlRecord[]>([]);
  const [mappingHealth, setMappingHealth] = useState<{
    mappedPools: number;
    discoveredPools: number;
    unmappedPools: number;
    staleMappings: number;
  } | null>(null);
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequestRecord[]>([]);
  const [governanceActions, setGovernanceActions] = useState<GovernanceActionRecord[]>([]);
  const [voucherRules, setVoucherRules] = useState<VoucherCompatibilityRule[]>([]);
  const [merchantLiquidityRows, setMerchantLiquidityRows] = useState<MerchantVoucherLiquidity[]>([]);
  const [onrampCheckoutSessions, setOnrampCheckoutSessions] = useState<OnrampCheckoutSessionSummary[]>([]);
  const [controlPlaneError, setControlPlaneError] = useState<string | null>(null);
  const [isControlPlaneLoading, setIsControlPlaneLoading] = useState(false);
  const [biaCreateForm, setBiaCreateForm] = useState({
    code: "",
    name: "",
    centerLat: "",
    centerLng: "",
  });
  const [mappingForm, setMappingForm] = useState({
    biaId: "",
    chainId: "42220",
    poolAddress: "",
    tokenRegistry: "",
    tokenLimiter: "",
    quoter: "",
    feeAddress: "",
    forceTouch: false,
  });
  const [controlsForm, setControlsForm] = useState({
    biaId: "",
    maxDailyRedemption: "",
    maxTxAmount: "",
    queueOnlyMode: false,
    isFrozen: false,
    reason: "",
  });
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, SettlementDraft>>({});
  const [voucherRuleForm, setVoucherRuleForm] = useState({
    poolAddress: "",
    tokenAddress: "",
    merchantStoreId: "",
    acceptedByDefault: true,
    ruleStatus: "active",
    reason: "",
  });

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

  const canAccessAdminDashboard = controlPlaneAccess.data?.canAccessAdminDashboard === true;
  const accessError = controlPlaneAccess.error instanceof Error ? controlPlaneAccess.error.message : null;

  useEffect(() => {
    if (isLoading || controlPlaneAccess.isLoading) {
      return;
    }

    if (accessError === "Unauthorized" || (!accessError && !canAccessAdminDashboard)) {
      router.replace("/dashboard");
    }
  }, [accessError, canAccessAdminDashboard, controlPlaneAccess.isLoading, isLoading, router]);

  const loadRequests = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!canAccessAdminDashboard) return;

    setIsFetching(true);
    setLoadError(null);

    try {
      const body = await fetchJson<{
        onRampRequests?: Array<Record<string, unknown>>;
        offRampRequests?: Array<Record<string, unknown>>;
        statuses?: Array<Record<string, unknown>>;
      }>("/api/admin/ramp-requests?citySlug=tcoin");

      const normalisedOnRamps: OnRampRequest[] = (body.onRampRequests ?? []).map(
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

      const normalisedOffRamps: OffRampRequest[] = (body.offRampRequests ?? []).map(
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

      const statusValues = (body.statuses ?? [])
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
        setLoadError(
          error instanceof Error ? error.message : "Unable to load the latest ramp requests. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [canAccessAdminDashboard]);

  useEffect(() => {
    if (!isLoading && !controlPlaneAccess.isLoading && canAccessAdminDashboard) {
      void loadRequests();
    }
  }, [canAccessAdminDashboard, controlPlaneAccess.isLoading, isLoading, loadRequests]);

  const loadControlPlaneData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsControlPlaneLoading(true);
    setControlPlaneError(null);

    try {
      const [
        biaList,
        mappingList,
        controlsList,
        redemptionList,
        governanceList,
        voucherRuleList,
        voucherMerchants,
        onrampAdminList,
      ] = await Promise.all([
        fetchJson<{ bias?: BiaRecord[]; controls?: BiaControlRecord[] }>(
          "/api/bias/list?citySlug=tcoin&includeMappings=true"
        ),
        fetchJson<{
          health?: {
            mappedPools: number;
            discoveredPools: number;
            unmappedPools: number;
            staleMappings: number;
          } | null;
        }>("/api/bias/mappings?citySlug=tcoin&chainId=42220"),
        fetchJson<{ controls?: BiaControlRecord[] }>("/api/bias/controls?citySlug=tcoin"),
        fetchJson<{ requests?: RedemptionRequestRecord[] }>(
          "/api/redemptions/list?citySlug=tcoin&limit=100"
        ),
        fetchJson<{ actions?: GovernanceActionRecord[] }>(
          "/api/governance/actions?citySlug=tcoin&limit=50"
        ),
        fetchJson<{ rules?: VoucherCompatibilityRule[] }>(
          "/api/vouchers/compatibility?citySlug=tcoin&chainId=42220"
        ),
        fetchJson<{ merchants?: MerchantVoucherLiquidity[] }>(
          "/api/vouchers/merchants?citySlug=tcoin&chainId=42220&scope=city"
        ),
        fetchJson<{ sessions?: OnrampCheckoutSessionSummary[] }>(
          "/api/onramp/admin/sessions?citySlug=tcoin&limit=50"
        ),
      ]);

      if (!isMountedRef.current) return;

      const nextBias = biaList.bias ?? [];
      setBiaRecords(nextBias);
      setBiaControls(controlsList.controls ?? biaList.controls ?? []);
      setMappingHealth(mappingList.health ?? null);
      setRedemptionRequests(redemptionList.requests ?? []);
      setGovernanceActions(governanceList.actions ?? []);
      setVoucherRules(voucherRuleList.rules ?? []);
      setMerchantLiquidityRows(voucherMerchants.merchants ?? []);
      setOnrampCheckoutSessions(onrampAdminList.sessions ?? []);
      setLastSyncedAt(new Date());

      if (nextBias.length > 0) {
        const fallbackBiaId = nextBias[0].id;
        setMappingForm((prev) => (prev.biaId ? prev : { ...prev, biaId: fallbackBiaId }));
        setControlsForm((prev) => (prev.biaId ? prev : { ...prev, biaId: fallbackBiaId }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load BIA/redemption control-plane data.";
      if (isMountedRef.current) {
        setControlPlaneError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsControlPlaneLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !controlPlaneAccess.isLoading && canAccessAdminDashboard) {
      void loadControlPlaneData();
    }
  }, [canAccessAdminDashboard, controlPlaneAccess.isLoading, isLoading, loadControlPlaneData]);

  useEffect(() => {
    if (!controlsForm.biaId) return;
    const existing = biaControls.find((control) => control.bia_id === controlsForm.biaId);
    if (!existing) return;

    setControlsForm((prev) => {
      const next = {
        ...prev,
        maxDailyRedemption:
          existing.max_daily_redemption != null ? String(existing.max_daily_redemption) : "",
        maxTxAmount: existing.max_tx_amount != null ? String(existing.max_tx_amount) : "",
        queueOnlyMode: Boolean(existing.queue_only_mode),
        isFrozen: Boolean(existing.is_frozen),
      };
      if (
        next.maxDailyRedemption === prev.maxDailyRedemption &&
        next.maxTxAmount === prev.maxTxAmount &&
        next.queueOnlyMode === prev.queueOnlyMode &&
        next.isFrozen === prev.isFrozen
      ) {
        return prev;
      }
      return next;
    });
  }, [controlsForm.biaId, biaControls]);

  const updateSettlementDraft = (requestId: string | number, updates: Partial<SettlementDraft>) => {
    const key = String(requestId);
    setSettlementDrafts((prev) => {
      const current: SettlementDraft = prev[key] ?? {
        settlementAmount: "",
        settlementAsset: "CAD",
        txHash: "",
        notes: "",
      };
      return {
        ...prev,
        [key]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const handleCreateBia = async () => {
    const code = biaCreateForm.code.trim().toUpperCase();
    const name = biaCreateForm.name.trim();
    const centerLat = Number.parseFloat(biaCreateForm.centerLat);
    const centerLng = Number.parseFloat(biaCreateForm.centerLng);

    if (!code || !name || !Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      toast.error("BIA code, name, and numeric center coordinates are required.");
      return;
    }

    const key = "create-bia";
    markSaving(key);

    try {
      await fetchJson("/api/bias/create", {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          code,
          name,
          centerLat,
          centerLng,
        }),
      });
      toast.success(`Created BIA ${code}.`);
      setBiaCreateForm({ code: "", name: "", centerLat: "", centerLng: "" });
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to create BIA", error);
      toast.error(error instanceof Error ? error.message : "Could not create BIA.");
    } finally {
      clearSaving(key);
    }
  };

  const handleCreateMapping = async () => {
    const chainId = Number.parseInt(mappingForm.chainId, 10);
    if (!mappingForm.biaId || !Number.isFinite(chainId) || chainId <= 0) {
      toast.error("Select a BIA and provide a valid chain id.");
      return;
    }
    if (mappingForm.poolAddress.trim() === "") {
      toast.error("Pool address is required.");
      return;
    }

    const key = "create-mapping";
    markSaving(key);

    try {
      await fetchJson("/api/bias/mappings", {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          biaId: mappingForm.biaId,
          chainId,
          poolAddress: mappingForm.poolAddress.trim(),
          tokenRegistry: mappingForm.tokenRegistry.trim() || null,
          tokenLimiter: mappingForm.tokenLimiter.trim() || null,
          quoter: mappingForm.quoter.trim() || null,
          feeAddress: mappingForm.feeAddress.trim() || null,
          mappingStatus: "active",
          forceTouch: mappingForm.forceTouch,
        }),
      });
      toast.success("Pool mapping saved.");
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to create mapping", error);
      toast.error(error instanceof Error ? error.message : "Could not create mapping.");
    } finally {
      clearSaving(key);
    }
  };

  const handleUpsertControls = async () => {
    if (!controlsForm.biaId) {
      toast.error("Select a BIA before saving controls.");
      return;
    }

    const key = "upsert-controls";
    markSaving(key);

    try {
      const maxDaily =
        controlsForm.maxDailyRedemption.trim() === ""
          ? null
          : Number.parseFloat(controlsForm.maxDailyRedemption);
      const maxTx =
        controlsForm.maxTxAmount.trim() === "" ? null : Number.parseFloat(controlsForm.maxTxAmount);

      if (
        (maxDaily != null && !Number.isFinite(maxDaily)) ||
        (maxTx != null && !Number.isFinite(maxTx))
      ) {
        throw new Error("maxDailyRedemption and maxTxAmount must be numeric when provided.");
      }

      await fetchJson("/api/bias/controls", {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          biaId: controlsForm.biaId,
          maxDailyRedemption: maxDaily,
          maxTxAmount: maxTx,
          queueOnlyMode: controlsForm.queueOnlyMode,
          isFrozen: controlsForm.isFrozen,
          reason: controlsForm.reason.trim() || "Controls updated from admin UI",
        }),
      });

      toast.success("BIA controls updated.");
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to update controls", error);
      toast.error(error instanceof Error ? error.message : "Could not update BIA controls.");
    } finally {
      clearSaving(key);
    }
  };

  const handleUpsertVoucherRule = async () => {
    const poolAddress = voucherRuleForm.poolAddress.trim();
    const tokenAddress = voucherRuleForm.tokenAddress.trim();
    const merchantStoreId = Number.parseInt(voucherRuleForm.merchantStoreId, 10);

    if (!poolAddress || !tokenAddress) {
      toast.error("Pool address and token address are required for voucher compatibility.");
      return;
    }

    const key = "upsert-voucher-rule";
    markSaving(key);

    try {
      await fetchJson("/api/vouchers/compatibility", {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          chainId: 42220,
          poolAddress,
          tokenAddress,
          merchantStoreId: Number.isFinite(merchantStoreId) && merchantStoreId > 0 ? merchantStoreId : null,
          acceptedByDefault: voucherRuleForm.acceptedByDefault,
          ruleStatus: voucherRuleForm.ruleStatus === "inactive" ? "inactive" : "active",
          reason: voucherRuleForm.reason.trim() || "Voucher compatibility updated from admin dashboard",
        }),
      });

      toast.success("Voucher compatibility rule saved.");
      setVoucherRuleForm((prev) => ({
        ...prev,
        poolAddress: "",
        tokenAddress: "",
        merchantStoreId: "",
        reason: "",
      }));
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to save voucher compatibility rule", error);
      toast.error(error instanceof Error ? error.message : "Could not save voucher compatibility rule.");
    } finally {
      clearSaving(key);
    }
  };

  const handleApproveRedemption = async (requestId: string | number, approve: boolean) => {
    const key = `redemption-approve-${requestId}`;
    markSaving(key);

    try {
      await fetchJson(`/api/redemptions/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          approve,
          rejectionReason: approve ? null : "Rejected in admin dashboard",
          reason: approve
            ? "Approved from admin dashboard"
            : "Rejected from admin dashboard",
        }),
      });
      toast.success(approve ? "Redemption approved." : "Redemption rejected.");
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to update redemption approval", error);
      toast.error(error instanceof Error ? error.message : "Could not update redemption status.");
    } finally {
      clearSaving(key);
    }
  };

  const handleSettleRedemption = async (request: RedemptionRequestRecord, failed = false) => {
    const key = `redemption-settle-${request.id}`;
    const draft = settlementDrafts[String(request.id)] ?? {
      settlementAmount: "",
      settlementAsset: "CAD",
      txHash: "",
      notes: "",
    };
    markSaving(key);

    try {
      const fallbackAmount =
        request.settlement_amount != null && Number.isFinite(request.settlement_amount)
          ? request.settlement_amount
          : request.token_amount;
      const parsedAmount =
        draft.settlementAmount.trim() === ""
          ? fallbackAmount
          : Number.parseFloat(draft.settlementAmount);
      if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Settlement amount must be a positive number.");
      }

      await fetchJson(`/api/redemptions/${request.id}/settle`, {
        method: "POST",
        body: JSON.stringify({
          citySlug: "tcoin",
          settlementAmount: parsedAmount,
          settlementAsset: draft.settlementAsset || request.settlement_asset || "CAD",
          txHash: draft.txHash.trim() || null,
          notes: draft.notes.trim() || null,
          failed,
          reason: failed
            ? "Marked as settlement failure from admin dashboard"
            : "Settled from admin dashboard",
        }),
      });
      toast.success(failed ? "Redemption marked as failed." : "Redemption settled.");
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to settle redemption", error);
      toast.error(error instanceof Error ? error.message : "Could not settle redemption.");
    } finally {
      clearSaving(key);
    }
  };

  const handleRetryOnrampSession = async (sessionId: string) => {
    const key = `onramp-retry-${sessionId}`;
    markSaving(key);
    try {
      await fetchJson(`/api/onramp/session/${sessionId}/retry`, {
        method: "POST",
        body: JSON.stringify({ citySlug: "tcoin" }),
      });
      toast.success("On-ramp settlement retry submitted.");
      await loadControlPlaneData();
    } catch (error) {
      console.error("Failed to retry on-ramp session", error);
      toast.error(error instanceof Error ? error.message : "Could not retry on-ramp settlement.");
    } finally {
      clearSaving(key);
    }
  };

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

  if (isLoading || controlPlaneAccess.isLoading) {
    return <div className="p-6 text-sm">Checking admin permissions…</div>;
  }

  if (accessError && accessError !== "Unauthorized") {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Could not verify access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{accessError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccessAdminDashboard) {
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
          <CardTitle>Buy TCOIN Checkout Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {onrampCheckoutSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No on-ramp checkout sessions found yet.
            </p>
          ) : (
            onrampCheckoutSessions.map((session) => {
              const isRetrying = pendingUpdates[`onramp-retry-${session.id}`] === true;
              const canRetry = session.status === "manual_review" || session.status === "failed";
              return (
                <div key={session.id} className="rounded-md border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Session {session.id}</p>
                      <p className="text-xs text-muted-foreground">
                        User #{session.userId} · {session.provider} · {session.fiatAmount} {session.fiatCurrency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDateTime(session.createdAt)} · Updated {formatDateTime(session.updatedAt)}
                      </p>
                    </div>
                    <Badge variant={getBadgeVariant(session.status)}>{session.status}</Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <p>Deposit: {session.depositAddress}</p>
                    <p>Recipient: {session.recipientWallet}</p>
                    <p>USDC tx: {session.incomingUsdcTxHash ?? "n/a"}</p>
                    <p>Mint tx: {session.mintTxHash ?? "n/a"}</p>
                    <p>TCOIN out: {session.tcoinOutAmount ?? "n/a"}</p>
                    <p>
                      Attempt: {session.latestAttemptNo ?? "n/a"} ({session.latestAttemptMode ?? "n/a"} /{" "}
                      {session.latestAttemptState ?? "n/a"})
                    </p>
                  </div>
                  {(session.statusReason || session.latestAttemptError) && (
                    <p className="text-xs text-red-600">
                      {session.statusReason ?? session.latestAttemptError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      disabled={!canRetry || isRetrying}
                      onClick={() => void handleRetryOnrampSession(session.id)}
                    >
                      {isRetrying ? "Retrying..." : "Retry Settlement"}
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

      <Card>
        <CardHeader>
          <CardTitle>BIA + Redemption Control Plane</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {controlPlaneError && (
            <Alert variant="destructive">
              <AlertTitle>Control plane data issue</AlertTitle>
              <AlertDescription>{controlPlaneError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">BIAs</p>
              <p className="text-2xl font-semibold">{biaRecords.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Redemption queue</p>
              <p className="text-2xl font-semibold">
                {redemptionRequests.filter((request) => request.status === "pending").length}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Unmapped pools</p>
              <p className="text-2xl font-semibold">{mappingHealth?.unmappedPools ?? 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Stale mappings</p>
              <p className="text-2xl font-semibold">{mappingHealth?.staleMappings ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => void loadControlPlaneData()}
              disabled={isControlPlaneLoading}
            >
              {isControlPlaneLoading ? "Refreshing…" : "Refresh control plane"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create BIA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Code (e.g. DTN)"
                value={biaCreateForm.code}
                onChange={(event) =>
                  setBiaCreateForm((prev) => ({ ...prev, code: event.target.value }))
                }
                aria-label="BIA code"
              />
              <Input
                placeholder="Name"
                value={biaCreateForm.name}
                onChange={(event) =>
                  setBiaCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                aria-label="BIA name"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Center latitude"
                value={biaCreateForm.centerLat}
                onChange={(event) =>
                  setBiaCreateForm((prev) => ({ ...prev, centerLat: event.target.value }))
                }
                aria-label="BIA center latitude"
              />
              <Input
                placeholder="Center longitude"
                value={biaCreateForm.centerLng}
                onChange={(event) =>
                  setBiaCreateForm((prev) => ({ ...prev, centerLng: event.target.value }))
                }
                aria-label="BIA center longitude"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => void handleCreateBia()}
                disabled={pendingUpdates["create-bia"] === true}
              >
                {pendingUpdates["create-bia"] ? "Creating…" : "Create BIA"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Map BIA to Pool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={mappingForm.biaId || undefined}
                onValueChange={(value) => setMappingForm((prev) => ({ ...prev, biaId: value }))}
              >
                <SelectTrigger aria-label="BIA for mapping">
                  <SelectValue placeholder="Select BIA" />
                </SelectTrigger>
                <SelectContent>
                  {biaRecords.map((bia) => (
                    <SelectItem key={bia.id} value={bia.id}>
                      {bia.code} · {bia.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Chain id"
                value={mappingForm.chainId}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, chainId: event.target.value }))
                }
                aria-label="Mapping chain id"
              />
            </div>
            <Input
              placeholder="Pool address"
              value={mappingForm.poolAddress}
              onChange={(event) =>
                setMappingForm((prev) => ({ ...prev, poolAddress: event.target.value }))
              }
              aria-label="Pool address"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Token registry address"
                value={mappingForm.tokenRegistry}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, tokenRegistry: event.target.value }))
                }
                aria-label="Token registry address"
              />
              <Input
                placeholder="Token limiter address"
                value={mappingForm.tokenLimiter}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, tokenLimiter: event.target.value }))
                }
                aria-label="Token limiter address"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Quoter address"
                value={mappingForm.quoter}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, quoter: event.target.value }))
                }
                aria-label="Quoter address"
              />
              <Input
                placeholder="Fee address"
                value={mappingForm.feeAddress}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, feeAddress: event.target.value }))
                }
                aria-label="Fee address"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mappingForm.forceTouch}
                onChange={(event) =>
                  setMappingForm((prev) => ({ ...prev, forceTouch: event.target.checked }))
                }
              />
              Trigger indexer touch after mapping save
            </label>
            <div className="flex justify-end">
              <Button
                onClick={() => void handleCreateMapping()}
                disabled={pendingUpdates["create-mapping"] === true}
              >
                {pendingUpdates["create-mapping"] ? "Saving…" : "Save Mapping"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>BIA Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={controlsForm.biaId || undefined}
              onValueChange={(value) => setControlsForm((prev) => ({ ...prev, biaId: value }))}
            >
              <SelectTrigger aria-label="BIA for controls">
                <SelectValue placeholder="Select BIA" />
              </SelectTrigger>
              <SelectContent>
                {biaRecords.map((bia) => (
                  <SelectItem key={bia.id} value={bia.id}>
                    {bia.code} · {bia.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Max daily redemption"
                value={controlsForm.maxDailyRedemption}
                onChange={(event) =>
                  setControlsForm((prev) => ({
                    ...prev,
                    maxDailyRedemption: event.target.value,
                  }))
                }
                aria-label="Max daily redemption"
              />
              <Input
                placeholder="Max transaction amount"
                value={controlsForm.maxTxAmount}
                onChange={(event) =>
                  setControlsForm((prev) => ({
                    ...prev,
                    maxTxAmount: event.target.value,
                  }))
                }
                aria-label="Max transaction amount"
              />
            </div>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={controlsForm.queueOnlyMode}
                  onChange={(event) =>
                    setControlsForm((prev) => ({ ...prev, queueOnlyMode: event.target.checked }))
                  }
                />
                Queue-only redemptions
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={controlsForm.isFrozen}
                  onChange={(event) =>
                    setControlsForm((prev) => ({ ...prev, isFrozen: event.target.checked }))
                  }
                />
                Freeze this BIA pool
              </label>
            </div>

            <Textarea
              rows={3}
              placeholder="Reason (logged to governance actions)"
              value={controlsForm.reason}
              onChange={(event) =>
                setControlsForm((prev) => ({ ...prev, reason: event.target.value }))
              }
              aria-label="Control change reason"
            />

            <div className="flex justify-end">
              <Button
                onClick={() => void handleUpsertControls()}
                disabled={pendingUpdates["upsert-controls"] === true}
              >
                {pendingUpdates["upsert-controls"] ? "Saving…" : "Save Controls"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Controls Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {biaControls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No BIA controls configured yet.</p>
            ) : (
              biaControls.map((control) => {
                const bia = biaRecords.find((candidate) => candidate.id === control.bia_id);
                return (
                  <div key={control.bia_id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">
                      {bia?.code ?? "Unknown"} · {bia?.name ?? control.bia_id}
                    </p>
                    <p className="text-muted-foreground">
                      Max daily:{" "}
                      {control.max_daily_redemption != null
                        ? tokenFormatter.format(control.max_daily_redemption)
                        : "none"}
                    </p>
                    <p className="text-muted-foreground">
                      Max tx:{" "}
                      {control.max_tx_amount != null
                        ? tokenFormatter.format(control.max_tx_amount)
                        : "none"}
                    </p>
                    <p className="text-muted-foreground">
                      Queue only: {String(Boolean(control.queue_only_mode))}
                    </p>
                    <p className="text-muted-foreground">
                      Frozen: {String(Boolean(control.is_frozen))}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Voucher Compatibility Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Pool address"
                value={voucherRuleForm.poolAddress}
                onChange={(event) =>
                  setVoucherRuleForm((prev) => ({ ...prev, poolAddress: event.target.value }))
                }
                aria-label="Voucher pool address"
              />
              <Input
                placeholder="Token address"
                value={voucherRuleForm.tokenAddress}
                onChange={(event) =>
                  setVoucherRuleForm((prev) => ({ ...prev, tokenAddress: event.target.value }))
                }
                aria-label="Voucher token address"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Merchant store id (optional)"
                value={voucherRuleForm.merchantStoreId}
                onChange={(event) =>
                  setVoucherRuleForm((prev) => ({ ...prev, merchantStoreId: event.target.value }))
                }
                aria-label="Voucher merchant store id"
              />
              <Select
                value={voucherRuleForm.ruleStatus}
                onValueChange={(value) =>
                  setVoucherRuleForm((prev) => ({ ...prev, ruleStatus: value }))
                }
              >
                <SelectTrigger aria-label="Voucher rule status">
                  <SelectValue placeholder="Rule status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={voucherRuleForm.acceptedByDefault}
                onChange={(event) =>
                  setVoucherRuleForm((prev) => ({
                    ...prev,
                    acceptedByDefault: event.target.checked,
                  }))
                }
              />
              Accept by default
            </label>
            <Textarea
              rows={2}
              placeholder="Reason (logged)"
              value={voucherRuleForm.reason}
              onChange={(event) =>
                setVoucherRuleForm((prev) => ({ ...prev, reason: event.target.value }))
              }
              aria-label="Voucher rule reason"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void handleUpsertVoucherRule()}
                disabled={pendingUpdates["upsert-voucher-rule"] === true}
              >
                {pendingUpdates["upsert-voucher-rule"] ? "Saving…" : "Save Voucher Rule"}
              </Button>
            </div>
            <div className="space-y-2">
              {voucherRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voucher rules configured yet.</p>
              ) : (
                voucherRules.slice(0, 20).map((rule) => (
                  <div key={rule.id} className="rounded-md border p-2 text-xs">
                    <p className="font-medium break-all">
                      {rule.pool_address} · {rule.token_address}
                    </p>
                    <p className="text-muted-foreground">
                      Status: {rule.rule_status} · accepted: {String(rule.accepted_by_default)}
                    </p>
                    <p className="text-muted-foreground">
                      Merchant: {rule.merchant_store_id ?? "any"} · updated {formatDateTime(rule.updated_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Merchant Voucher Liquidity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Voucher issuance and liquidity requirements are read from Sarafu pool/limiter contracts. These values are
              read-only in Genero.
            </p>
            {merchantLiquidityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No merchant voucher liquidity rows found.</p>
            ) : (
              merchantLiquidityRows.slice(0, 40).map((row, index) => (
                <div
                  key={`${row.merchantStoreId}:${row.tokenAddress ?? "none"}:${index}`}
                  className="rounded-md border p-2 text-xs"
                >
                  <p className="font-medium">
                    {row.displayName ?? `Store ${row.merchantStoreId}`} · {row.tokenSymbol ?? "n/a"}
                  </p>
                  <p className="text-muted-foreground">
                    BIA: {row.biaCode ?? "n/a"} · Pool: {row.poolAddress ?? "n/a"}
                  </p>
                  <p className="text-muted-foreground">
                    Credit issued: {row.creditIssued ?? "0"} · remaining: {row.creditRemaining ?? "n/a"}
                  </p>
                  <p className="text-muted-foreground">
                    Voucher limit: {row.voucherIssueLimit ?? "null"} · liquidity abs:{" "}
                    {row.requiredLiquidityAbsolute ?? "null"} · liquidity ratio:{" "}
                    {row.requiredLiquidityRatio ?? "null"}
                  </p>
                  <p className="text-muted-foreground">
                    Source: {formatLiquiditySource(row.sourceMode)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Redemption Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {redemptionRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemption requests found.</p>
          ) : (
            redemptionRequests.map((request) => {
              const requestId = String(request.id);
              const approvalPending = pendingUpdates[`redemption-approve-${requestId}`] === true;
              const settlementPending = pendingUpdates[`redemption-settle-${requestId}`] === true;
              const draft = settlementDrafts[requestId] ?? {
                settlementAmount:
                  request.settlement_amount != null ? String(request.settlement_amount) : "",
                settlementAsset: request.settlement_asset ?? "CAD",
                txHash: request.tx_hash ?? "",
                notes: "",
              };
              const settlementRows = request.settlements ?? [];
              const canApprove = request.status === "pending";
              const canSettle = request.status === "approved";
              const canFail = ["pending", "approved"].includes(request.status);

              return (
                <div key={requestId} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Redemption #{requestId}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(request.created_at)} · {request.bia?.code ?? "No BIA"} ·{" "}
                        {request.storeProfile?.display_name ?? `Store ${request.storeProfile?.store_id ?? "?"}`}
                      </p>
                      {request.pool_address && (
                        <p className="text-xs text-muted-foreground break-all">
                          Pool {request.pool_address}
                        </p>
                      )}
                      {request.rejection_reason && (
                        <p className="text-xs text-muted-foreground">
                          Rejection reason: {request.rejection_reason}
                        </p>
                      )}
                    </div>
                    <Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <p className="text-sm">
                      Token amount: {tokenFormatter.format(request.token_amount ?? 0)}
                    </p>
                    <p className="text-sm">
                      Settlement target:{" "}
                      {request.settlement_amount != null
                        ? cadFormatter.format(request.settlement_amount)
                        : "Not set"}{" "}
                      {request.settlement_asset ?? ""}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="Settlement amount"
                      value={draft.settlementAmount}
                      onChange={(event) =>
                        updateSettlementDraft(requestId, { settlementAmount: event.target.value })
                      }
                      aria-label={`Settlement amount for ${requestId}`}
                    />
                    <Input
                      placeholder="Settlement asset"
                      value={draft.settlementAsset}
                      onChange={(event) =>
                        updateSettlementDraft(requestId, { settlementAsset: event.target.value })
                      }
                      aria-label={`Settlement asset for ${requestId}`}
                    />
                    <Input
                      placeholder="Settlement tx hash (optional)"
                      value={draft.txHash}
                      onChange={(event) =>
                        updateSettlementDraft(requestId, { txHash: event.target.value })
                      }
                      aria-label={`Settlement tx hash for ${requestId}`}
                    />
                    <Input
                      placeholder="Settlement notes"
                      value={draft.notes}
                      onChange={(event) =>
                        updateSettlementDraft(requestId, { notes: event.target.value })
                      }
                      aria-label={`Settlement notes for ${requestId}`}
                    />
                  </div>

                  {settlementRows.length > 0 && (
                    <div className="mt-3 rounded-md bg-muted p-3 text-xs">
                      <p className="font-medium">Settlements</p>
                      {settlementRows.map((row) => (
                        <p key={String(row.id)}>
                          {row.status} · {row.settlement_amount ?? "?"} {row.settlement_asset ?? ""} ·{" "}
                          {formatDateTime(row.created_at)}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={!canApprove || approvalPending}
                      onClick={() => void handleApproveRedemption(request.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canApprove || approvalPending}
                      onClick={() => void handleApproveRedemption(request.id, false)}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={!canSettle || settlementPending}
                      onClick={() => void handleSettleRedemption(request, false)}
                    >
                      Settle
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canFail || settlementPending}
                      onClick={() => void handleSettleRedemption(request, true)}
                    >
                      Mark Failed
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
          <CardTitle>Governance Actions Feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {governanceActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No governance actions logged yet.</p>
          ) : (
            governanceActions.map((action) => (
              <div key={String(action.id)} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{action.action_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(action.created_at)}
                  </p>
                </div>
                {action.reason && <p className="text-muted-foreground">{action.reason}</p>}
                <p className="text-xs text-muted-foreground">
                  BIA: {action.bia_id ?? "n/a"} · Store: {action.store_id ?? "n/a"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
