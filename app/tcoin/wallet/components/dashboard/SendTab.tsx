import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import { Hypodata, InvoicePayRequest, contactRecordToHypodata } from "./types";
import { SendCard, type PaymentCompletionDetails } from "./SendCard";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import { extractTransactionId } from "@shared/utils/transferRecord";

interface SendTabProps {
  recipient: Hypodata | null;
  onRecipientChange?: (recipient: Hypodata | null) => void;
  contacts?: ContactRecord[];
}

type IncomingRequest = InvoicePayRequest & { requester: Hypodata | null };

const CLOSED_REQUEST_STATUSES = new Set([
  "paid",
  "completed",
  "cancelled",
  "closed",
  "fulfilled",
]);

const formatRequestAmount = (amount: number | null | undefined) => {
  if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
    return "Any Amount";
  }
  return `${(amount ?? 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TCOIN`;
};

const formatRequesterName = (
  request: IncomingRequest
): { primary: string; secondary: string } => {
  const requester = request.requester;
  const fallbackId = (() => {
    const value = request.request_by;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  })();

  if (!requester) {
    const fallback = fallbackId != null ? `User #${fallbackId}` : "Unknown";
    return { primary: fallback, secondary: "Requested via contact" };
  }

  const primary = requester.full_name?.trim() || requester.username?.trim();
  const secondary = requester.username?.trim()
    ? `@${requester.username.trim()}`
    : fallbackId != null
      ? `User #${fallbackId}`
      : "";

  return {
    primary: primary ?? (fallbackId != null ? `User #${fallbackId}` : "Unknown"),
    secondary,
  };
};

const coerceTransactionId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveTransactionId = (
  details?: PaymentCompletionDetails
): number | null => {
  if (!details) return null;

  const direct = coerceTransactionId(details.transactionId);
  if (direct != null) {
    return direct;
  }

  return extractTransactionId(details.transferRecord);
};

export function SendTab({ recipient, onRecipientChange, contacts }: SendTabProps) {
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();
  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;
  const sanitizeNumeric = (value: string) => value.replace(/[^\d.]/g, "");
  const [toSendData, setToSendData] = useState<Hypodata | null>(recipient);
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [explorerLink, setExplorerLink] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "link">("manual");
  const [activeAction, setActiveAction] = useState<
    "manual" | "scan" | "link" | "requests"
  >("manual");
  const [, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequest | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [payLink, setPayLink] = useState("");
  const { openModal, closeModal } = useModal();
  const contactsById = useMemo(() => {
    const map = new Map<number, Hypodata>();
    (contacts ?? []).forEach((contact) => {
      map.set(contact.id, contactRecordToHypodata(contact));
    });
    return map;
  }, [contacts]);

  const {
    senderWallet,
    sendMoney,
    executeVoucherPayment,
    getLastTransferRecord,
  } = useSendMoney({
    senderId: userData?.cubidData?.id ?? 0,
    receiverId: toSendData?.id ?? null,
  });
  const { balance: rawBalance } = useTokenBalance(senderWallet ?? null);
  const balance = parseFloat(rawBalance) || 0;

  const selectedRequestAmount = useMemo(() => {
    if (!selectedRequest) return null;
    const raw = selectedRequest.amount_requested;
    if (typeof raw === "number") {
      return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [selectedRequest]);

  const shouldLockAmount =
    selectedRequestAmount != null ? selectedRequestAmount > 0 : false;


  useEffect(() => {
    setToSendData(recipient);
  }, [recipient]);

  const updateRecipient = useCallback(
    (value: Hypodata | null | undefined) => {
      const normalised = value ?? null;
      setToSendData(normalised);
      onRecipientChange?.(normalised);
    },
    [onRecipientChange]
  );

  const handleUseMax = () => {
    const cadNumeric = safeExchangeRate === 0 ? 0 : balance * safeExchangeRate;
    setTcoinAmount(balance.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const postPaymentRecord = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        await fetch("/api/vouchers/payment-record", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            citySlug: "tcoin",
            chainId: 42220,
            payerWallet: senderWallet,
            recipientWallet: toSendData?.wallet_address ?? null,
            ...payload,
          }),
        });
      } catch {
        // Best-effort logging only.
      }
    },
    [senderWallet, toSendData?.wallet_address]
  );

  const sendMoneyWithRouting = useCallback(
    async (amount: string) => {
      const recipientWallet =
        typeof toSendData?.wallet_address === "string" ? toSendData.wallet_address.trim() : "";
      const amountNumeric = Number.parseFloat(amount);
      if (!recipientWallet || !Number.isFinite(amountNumeric) || amountNumeric <= 0) {
        return sendMoney(amount);
      }

      try {
        const isIrrecoverableVoucherExecutionError = (error: unknown) => {
          if (!(error instanceof Error)) {
            return false;
          }
          const message = error.message.toLowerCase();
          return (
            message.includes("post-trade slippage") ||
            message.includes("after successful swap") ||
            message.includes("swap tx:")
          );
        };

        const response = await fetch(
          `/api/vouchers/route?citySlug=tcoin&amount=${encodeURIComponent(
            amountNumeric.toString()
          )}&recipientWallet=${encodeURIComponent(recipientWallet)}`,
          { credentials: "include" }
        );
        const body = await response.json();
        const quote = body?.quote;

        if (!quote || quote.mode !== "voucher") {
          const fallbackTxHash = await sendMoney(amount);
          await postPaymentRecord({
            mode: "tcoin_fallback",
            transferTxHash: fallbackTxHash,
            amountTcoin: amountNumeric,
            status: "completed",
            fallbackReason:
              typeof quote?.reason === "string" ? quote.reason : "No eligible voucher route.",
            metadata: {
              guardDecisions: Array.isArray(quote?.guardDecisions) ? quote.guardDecisions : [],
              quoteSource: typeof quote?.quoteSource === "string" ? quote.quoteSource : "fallback",
              feePpm: typeof quote?.feePpm === "number" ? quote.feePpm : null,
            },
          });
          return fallbackTxHash;
        }

        const attemptVoucher = async (routeQuote: any) => {
          const voucherTx = await executeVoucherPayment({
            amount,
            poolAddress: routeQuote.poolAddress,
            voucherTokenAddress: routeQuote.tokenAddress,
            recipientWalletAddress: recipientWallet,
            minAmountOut: routeQuote.minVoucherOut ?? amount,
            tokenDecimals:
              typeof routeQuote.tokenDecimals === "number" ? routeQuote.tokenDecimals : 18,
          });
          await postPaymentRecord({
            mode: "voucher",
            poolAddress: routeQuote.poolAddress,
            tokenAddress: routeQuote.tokenAddress,
            amountTcoin: amountNumeric,
            amountVoucher: Number.parseFloat(voucherTx.transferAmount),
            swapTxHash: voucherTx.swapTxHash,
            transferTxHash: voucherTx.transferTxHash,
            status: "completed",
            metadata: {
              approvalTxHash: voucherTx.approvalTxHash,
              guardDecisions: routeQuote.guardDecisions,
              quoteSource: routeQuote.quoteSource,
              feePpm: typeof routeQuote.feePpm === "number" ? routeQuote.feePpm : null,
            },
          });
          return voucherTx.transferTxHash;
        };

        try {
          return await attemptVoucher(quote);
        } catch (firstError) {
          if (isIrrecoverableVoucherExecutionError(firstError)) {
            await postPaymentRecord({
              mode: "voucher",
              amountTcoin: amountNumeric,
              status: "failed",
              fallbackReason:
                firstError instanceof Error
                  ? firstError.message
                  : "Voucher execution failed after swap.",
              metadata: {
                guardDecisions: Array.isArray(quote?.guardDecisions) ? quote.guardDecisions : [],
                quoteSource: typeof quote?.quoteSource === "string" ? quote.quoteSource : "unknown",
              },
            });
            throw firstError;
          }

          // Retry once with refreshed quote before falling back.
          try {
            const retryResponse = await fetch(
              `/api/vouchers/route?citySlug=tcoin&amount=${encodeURIComponent(
                amountNumeric.toString()
              )}&recipientWallet=${encodeURIComponent(recipientWallet)}`,
              { credentials: "include" }
            );
            const retryBody = await retryResponse.json();
            const retryQuote = retryBody?.quote;
            if (!retryQuote || retryQuote.mode !== "voucher") {
              throw firstError;
            }
            return await attemptVoucher(retryQuote);
          } catch (retryError) {
            if (isIrrecoverableVoucherExecutionError(retryError)) {
              await postPaymentRecord({
                mode: "voucher",
                amountTcoin: amountNumeric,
                status: "failed",
                fallbackReason:
                  retryError instanceof Error
                    ? retryError.message
                    : "Voucher execution failed after swap.",
                metadata: {
                  quoteSource: typeof quote?.quoteSource === "string" ? quote.quoteSource : "unknown",
                },
              });
              throw retryError;
            }

            const fallbackTxHash = await sendMoney(amount);
            await postPaymentRecord({
              mode: "tcoin_fallback",
              transferTxHash: fallbackTxHash,
              amountTcoin: amountNumeric,
              status: "completed",
              fallbackReason:
                retryError instanceof Error
                  ? `Voucher route failed: ${retryError.message}`
                  : "Voucher route failed.",
            });
            return fallbackTxHash;
          }
        }
      } catch (routeError) {
        const fallbackTxHash = await sendMoney(amount);
        await postPaymentRecord({
          mode: "tcoin_fallback",
          transferTxHash: fallbackTxHash,
          amountTcoin: amountNumeric,
          status: "completed",
          fallbackReason:
            routeError instanceof Error
              ? `Voucher routing unavailable: ${routeError.message}`
              : "Voucher routing unavailable.",
        });
        return fallbackTxHash;
      }
    },
    [toSendData?.wallet_address, executeVoucherPayment, sendMoney, postPaymentRecord]
  );

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeNumeric(e.target.value);
    setTcoinAmount(raw);
    if (raw === "") {
      setCadAmount("");
      return;
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) {
      setCadAmount("");
      return;
    }
    if (safeExchangeRate === 0) {
      setCadAmount("");
      return;
    }
    setCadAmount((num * safeExchangeRate).toString());
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeNumeric(e.target.value);
    setCadAmount(raw);
    if (raw === "") {
      setTcoinAmount("");
      return;
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num) || safeExchangeRate === 0) {
      setTcoinAmount("");
      return;
    }
    setTcoinAmount((num / safeExchangeRate).toString());
  };

  const handleTcoinBlur = () => {
    if (tcoinAmount.trim() === "") {
      setCadAmount("");
      return;
    }
    const numeric = Number.parseFloat(tcoinAmount);
    if (!Number.isFinite(numeric)) {
      setTcoinAmount("");
      setCadAmount("");
      return;
    }
    const cadNumeric = safeExchangeRate === 0 ? 0 : numeric * safeExchangeRate;
    setTcoinAmount(numeric.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const handleCadBlur = () => {
    if (cadAmount.trim() === "") {
      setTcoinAmount("");
      return;
    }
    const numeric = Number.parseFloat(cadAmount);
    if (!Number.isFinite(numeric)) {
      setCadAmount("");
      setTcoinAmount("");
      return;
    }
    const tcoinNumeric = safeExchangeRate === 0 ? 0 : numeric / safeExchangeRate;
    setCadAmount(numeric.toFixed(2));
    setTcoinAmount(tcoinNumeric.toFixed(2));
  };

  const reset = useCallback(() => {
    updateRecipient(null);
    setTcoinAmount("");
    setCadAmount("");
    setPayLink("");
  }, [updateRecipient]);

  const openScanner = useCallback(() => {
    openModal({
      content: (
        <QrScanModal
          closeModal={closeModal}
          setToSendData={(d: Hypodata) => updateRecipient(d)}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
        />
      ),
      title: "Scan QR",
      description: "Use your device's camera to scan a code.",
    });
  }, [closeModal, openModal, updateRecipient]);

  const fetchIncomingRequests = useCallback(async (): Promise<IncomingRequest[]> => {
    const currentUserId = userData?.cubidData?.id;
    if (!currentUserId) {
      setIncomingRequests([]);
      return [];
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoice_pay_request")
        .select("*")
        .eq("request_from", currentUserId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as InvoicePayRequest[];
      const filtered = rows.filter((request) => {
        if (request.is_active === false) {
          return false;
        }

        if (typeof request.status === "string") {
          const status = request.status.trim().toLowerCase();
          if (CLOSED_REQUEST_STATUSES.has(status)) {
            return false;
          }
        }

        return true;
      });

      const requesterIds = Array.from(
        new Set(
          filtered
            .map((request) => {
              if (typeof request.request_by === "number" && Number.isFinite(request.request_by)) {
                return request.request_by;
              }
              if (typeof request.request_by === "string") {
                const parsed = Number.parseInt(request.request_by, 10);
                if (Number.isFinite(parsed)) {
                  return parsed;
                }
              }
              return null;
            })
            .filter((value): value is number => value != null)
        )
      );

      const requesterMap = new Map<number, Hypodata>();
      contactsById.forEach((value, key) => {
        requesterMap.set(key, value);
      });

      if (requesterIds.length > 0) {
        const { data: userRows, error: userError } = await supabase
          .from("users")
          .select("id, full_name, username, profile_image_url")
          .in("id", requesterIds);

        if (userError) throw userError;

        const { data: walletRows, error: walletError } = await supabase
          .from("wallet_list")
          .select("user_id, public_key")
          .in("user_id", requesterIds);

        if (walletError) throw walletError;

        const walletMap = new Map<number, string | undefined>();
        for (const wallet of walletRows ?? []) {
          const id = Number(wallet.user_id);
          if (Number.isFinite(id)) {
            walletMap.set(id, typeof wallet.public_key === "string" ? wallet.public_key : undefined);
          }
        }

        for (const row of userRows ?? []) {
          const id = Number(row.id);
          if (!Number.isFinite(id)) continue;
          const existing = requesterMap.get(id);
          requesterMap.set(id, {
            id,
            full_name: row.full_name ?? existing?.full_name ?? undefined,
            username: row.username ?? existing?.username ?? undefined,
            profile_image_url: row.profile_image_url ?? existing?.profile_image_url ?? undefined,
            wallet_address: walletMap.get(id) ?? existing?.wallet_address ?? undefined,
            state: existing?.state ?? undefined,
          });
        }
      }

      const enriched = filtered.map((request) => {
        let requesterId: number | null = null;
        if (typeof request.request_by === "number" && Number.isFinite(request.request_by)) {
          requesterId = request.request_by;
        } else if (typeof request.request_by === "string") {
          const parsed = Number.parseInt(request.request_by, 10);
          if (Number.isFinite(parsed)) {
            requesterId = parsed;
          }
        }

        const requester = requesterId != null ? requesterMap.get(requesterId) ?? null : null;
        return { ...request, requester } as IncomingRequest;
      });

      setIncomingRequests(enriched);
      return enriched;
    } catch (error) {
      console.error("Failed to fetch incoming requests:", error);
      setIncomingRequests([]);
      return [];
    }
  }, [contactsById, userData?.cubidData?.id]);

  const handleRequestSelection = useCallback(
    async (request: IncomingRequest) => {
      let requester = request.requester ?? null;
      let requesterId: number | null = null;
      if (typeof request.request_by === "number" && Number.isFinite(request.request_by)) {
        requesterId = request.request_by;
      } else if (typeof request.request_by === "string") {
        const parsed = Number.parseInt(request.request_by, 10);
        if (Number.isFinite(parsed)) {
          requesterId = parsed;
        }
      }

      if (!requester && requesterId != null) {
        requester = contactsById.get(requesterId) ?? null;
      }

      if (!requester && requesterId != null) {
        try {
          const supabase = createClient();
          const { data: userRow, error: userError } = await supabase
            .from("users")
            .select("id, full_name, username, profile_image_url")
            .eq("id", requesterId)
            .single();

          if (userError) throw userError;

          const { data: walletRow } = await supabase
            .from("wallet_list")
            .select("public_key")
            .eq("user_id", requesterId)
            .single();

          requester = {
            id: requesterId,
            full_name: userRow?.full_name ?? undefined,
            username: userRow?.username ?? undefined,
            profile_image_url: userRow?.profile_image_url ?? undefined,
            wallet_address: walletRow?.public_key ?? undefined,
            state: undefined,
          };
        } catch (error) {
          console.error("Unable to load requester details:", error);
        }
      }

      if (!requester) {
        toast.error("Unable to load the requester details for this request.");
        return;
      }

      updateRecipient(requester);

      const numericAmount =
        typeof request.amount_requested === "number"
          ? request.amount_requested
          : Number.parseFloat(String(request.amount_requested ?? "0"));
      const safeAmount = Number.isFinite(numericAmount) ? Math.max(numericAmount, 0) : 0;

      if (safeAmount > 0) {
        setTcoinAmount(safeAmount.toFixed(2));
        if (safeExchangeRate > 0) {
          setCadAmount((safeAmount * safeExchangeRate).toFixed(2));
        } else {
          setCadAmount("");
        }
      } else {
        setTcoinAmount("");
        setCadAmount("");
      }

      setSelectedRequest({ ...request, requester });
      setActiveAction("requests");
      setMode("manual");
      setPayLink("");
      closeModal();
    },
    [closeModal, contactsById, safeExchangeRate, updateRecipient]
  );

  const handleIgnoreRequest = useCallback(
    async (request: IncomingRequest) => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("invoice_pay_request")
          .update({ is_active: false })
          .eq("id", request.id);

        if (error) throw error;

        setIncomingRequests((prev) =>
          prev.filter((existing) => existing.id !== request.id)
        );
        toast.success("Request ignored.");
        return true;
      } catch (error) {
        console.error("Failed to ignore request:", error);
        toast.error("Failed to ignore this request. Please try again.");
        return false;
      } finally {
        void fetchIncomingRequests();
      }
    },
    [fetchIncomingRequests]
  );

  const openRequestsModal = useCallback(async () => {
    if (isLoadingRequests) return;
    setIsLoadingRequests(true);
    try {
      const requests = await fetchIncomingRequests();
      setIncomingRequests(requests);
      openModal({
        title: "Incoming Requests To Pay",
        description:
          "Choose a request to pay or ignore. Ignored requests will be archived.",
        content: (
          <RequestsList
            requests={requests}
            onSelect={(selection) => {
              void handleRequestSelection(selection);
            }}
            onIgnore={(request) => handleIgnoreRequest(request)}
          />
        ),
      });
    } finally {
      setIsLoadingRequests(false);
    }
  }, [
    fetchIncomingRequests,
    handleIgnoreRequest,
    handleRequestSelection,
    isLoadingRequests,
    openModal,
  ]);

  const handleManualClick = () => {
    if (selectedRequest) {
      setSelectedRequest(null);
    }
    setMode("manual");
    setActiveAction("manual");
  };

  const handleScanClick = () => {
    const hadRequest = Boolean(selectedRequest);
    if (hadRequest) {
      setSelectedRequest(null);
    }
    reset();
    setMode("manual");
    setActiveAction("scan");
    openScanner();
  };

  const handleLinkClick = () => {
    const hadRequest = Boolean(selectedRequest);
    if (hadRequest) {
      setSelectedRequest(null);
    }
    reset();
    setPayLink("");
    setMode("link");
    setActiveAction("link");
  };

  const handleRequestPaid = useCallback(
    async (details?: PaymentCompletionDetails) => {
      if (!selectedRequest) return;
      const requestId = selectedRequest.id;
      try {
        const supabase = createClient();
        const updates = {
          status: "paid",
          paid_at: new Date().toISOString(),
          transaction_id: resolveTransactionId(details) ?? null,
          is_active: false,
        };
        await supabase
          .from("invoice_pay_request")
          .update(updates)
          .eq("id", requestId);
      } catch (error) {
        console.error("Failed to mark request as paid:", error);
      } finally {
        setSelectedRequest(null);
        setActiveAction("manual");
        void fetchIncomingRequests();
      }
    },
    [fetchIncomingRequests, selectedRequest]
  );

  useEffect(() => {
    if (!selectedRequest && activeAction === "requests") {
      setActiveAction("manual");
    }
  }, [activeAction, selectedRequest]);

  useEffect(() => {
    if (!toSendData && selectedRequest) {
      setSelectedRequest(null);
    }
  }, [selectedRequest, toSendData]);

  useEffect(() => {
    void fetchIncomingRequests();
  }, [fetchIncomingRequests]);

  const extractAndDecodeBase64 = (url: string) => {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData);
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  };

  const handlePayLink = async () => {
    const decoded = extractAndDecodeBase64(payLink);
    const { nano_id, qrTcoinAmount } = decoded ?? {};
    if (!nano_id) {
      toast.error("Invalid pay link");
      return;
    }
    try {
      const supabase = createClient();
      const { data: userDataFromSupabaseTable, error } = await supabase
        .from("users")
        .select("*")
        .match({ user_identifier: nano_id });
      if (error) throw error;
      updateRecipient(userDataFromSupabaseTable?.[0] ?? null);
      if (qrTcoinAmount) {
        const sanitized = sanitizeNumeric(String(qrTcoinAmount));
        if (sanitized) {
          const num = Number.parseFloat(sanitized);
          if (Number.isFinite(num)) {
            const cadNumeric = safeExchangeRate === 0 ? 0 : num * safeExchangeRate;
            setTcoinAmount(num.toFixed(2));
            setCadAmount(cadNumeric.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("handlePayLink error", err);
      toast.error("Failed to process link");
    }
  };

  const modeActions = (
    <>
      <Button
        type="button"
        variant={activeAction === "manual" ? "default" : "outline"}
        onClick={handleManualClick}
        className="min-w-[120px]"
      >
        Manual
      </Button>
      <Button
        type="button"
        variant={activeAction === "scan" ? "default" : "outline"}
        onClick={handleScanClick}
        className="min-w-[120px]"
      >
        Scan QR Code
      </Button>
      <Button
        type="button"
        variant={activeAction === "link" ? "default" : "outline"}
        onClick={handleLinkClick}
        className="min-w-[120px]"
      >
        Pay Link
      </Button>
      <Button
        type="button"
        variant={activeAction === "requests" ? "default" : "outline"}
        onClick={() => {
          void openRequestsModal();
        }}
        className="min-w-[120px]"
        disabled={isLoadingRequests}
      >
        Requests
      </Button>
    </>
  );

  const lockRecipient = Boolean(selectedRequest);
  const lockAmount = lockRecipient ? shouldLockAmount : false;
  const recipientHeading = selectedRequest ? "Requested By:" : undefined;

  return (
    <div className="space-y-4 lg:px-[25vw]">
      {mode !== "link" && (
        <SendCard
          toSendData={toSendData}
          setToSendData={updateRecipient}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          handleTcoinBlur={handleTcoinBlur}
          handleCadBlur={handleCadBlur}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          sendMoney={sendMoneyWithRouting}
          userBalance={balance}
          onUseMax={handleUseMax}
          contacts={contacts}
          amountHeaderActions={modeActions}
          locked={lockRecipient}
          actionLabel={selectedRequest ? "Pay this request" : "Send..."}
          getLastTransferRecord={getLastTransferRecord}
          onPaymentComplete={selectedRequest ? handleRequestPaid : undefined}
          lockRecipient={lockRecipient}
          lockAmount={lockAmount}
          recipientHeading={recipientHeading}
        />
      )}

      {mode === "link" && (
        <>
          {!toSendData ? (
            <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Amount</h2>
                {modeActions}
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  placeholder="Paste pay link"
                  value={payLink}
                  onChange={(e) => setPayLink(e.target.value)}
                />
                <Button className="w-full" onClick={handlePayLink}>
                  Load Link
                </Button>
              </div>
            </section>
          ) : (
            <SendCard
              locked
              toSendData={toSendData}
              setToSendData={updateRecipient}
              tcoinAmount={tcoinAmount}
              cadAmount={cadAmount}
              handleTcoinChange={handleTcoinChange}
              handleCadChange={handleCadChange}
              handleTcoinBlur={handleTcoinBlur}
              handleCadBlur={handleCadBlur}
              explorerLink={explorerLink}
              setExplorerLink={setExplorerLink}
              sendMoney={sendMoneyWithRouting}
              userBalance={balance}
              onUseMax={handleUseMax}
              contacts={contacts}
              amountHeaderActions={modeActions}
              getLastTransferRecord={getLastTransferRecord}
            />
          )}
        </>
      )}
    </div>
  );
}

function RequestsList({
  requests,
  onSelect,
  onIgnore,
}: {
  requests: IncomingRequest[];
  onSelect: (request: IncomingRequest) => void;
  onIgnore: (request: IncomingRequest) => Promise<boolean>;
}) {
  const [visibleRequests, setVisibleRequests] = React.useState(requests);

  React.useEffect(() => {
    setVisibleRequests(requests);
  }, [requests]);

  if (visibleRequests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have no incoming requests to pay right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleRequests.map((request) => {
        const { primary, secondary } = formatRequesterName(request);
        const createdLabel = request.created_at
          ? new Date(request.created_at).toLocaleDateString("en-CA")
          : null;

        const handleIgnore = async () => {
          const success = await onIgnore(request);
          if (success) {
            setVisibleRequests((prev) =>
              prev.filter((existing) => existing.id !== request.id)
            );
          }
        };

        return (
          <div
            key={request.id}
            className="w-full rounded-xl border border-border/60 bg-background/80 p-4 text-left"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {formatRequestAmount(request.amount_requested)}
                </span>
                {createdLabel && (
                  <span className="text-xs text-muted-foreground">
                    {createdLabel}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Requested by {primary}
                {secondary ? ` (${secondary})` : ""}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => onSelect(request)}
              >
                Pay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white text-foreground hover:bg-white/90"
                onClick={() => {
                  void handleIgnore();
                }}
              >
                Ignore
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
