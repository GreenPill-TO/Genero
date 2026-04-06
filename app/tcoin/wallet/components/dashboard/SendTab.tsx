import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useCameraAvailability } from "@shared/hooks/useCameraAvailability";
import {
  dismissPaymentRequest,
  getIncomingPaymentRequests,
  markPaymentRequestPaid,
} from "@shared/lib/edge/paymentRequestsClient";
import {
  consumePaymentRequestLink,
  resolvePaymentRequestLink,
} from "@shared/lib/edge/paymentRequestLinksClient";
import type { PaymentRequestLinkResolution } from "@shared/lib/edge/paymentRequestLinks";
import { lookupWalletUserByIdentifier } from "@shared/lib/edge/walletOperationsClient";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useClearPendingPaymentIntentMutation } from "@shared/hooks/useUserSettingsMutations";
import {
  decodeLegacyWalletPayPayload,
  extractWalletPayToken,
} from "@shared/lib/walletPayLinks";
import { Hypodata, InvoicePayRequest, contactRecordToHypodata } from "./types";
import { SendCard, type PaymentCompletionDetails } from "./SendCard";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import type { UserSettingsPendingPaymentIntent } from "@shared/lib/userSettings/types";
import { extractTransactionId } from "@shared/utils/transferRecord";

interface SendTabProps {
  recipient: Hypodata | null;
  onRecipientChange?: (recipient: Hypodata | null) => void;
  contacts?: ContactRecord[];
  paymentLinkToken?: string | null;
  resumePendingPayment?: boolean;
  pendingPaymentIntent?: UserSettingsPendingPaymentIntent | null;
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
    const value = request.requestBy;
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

export function SendTab({
  recipient,
  onRecipientChange,
  contacts,
  paymentLinkToken,
  resumePendingPayment = false,
  pendingPaymentIntent = null,
}: SendTabProps) {
  const { userData } = useAuth();
  const { hasCamera, isCheckingCamera } = useCameraAvailability();
  const clearPendingPaymentIntent = useClearPendingPaymentIntentMutation();
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
  const [activeAction, setActiveAction] = useState<
    "manual" | "scan" | "link" | "requests"
  >("manual");
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequest | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [payLink, setPayLink] = useState("");
  const [activePaymentLinkToken, setActivePaymentLinkToken] = useState<string | null>(null);
  const [pendingPaymentSource, setPendingPaymentSource] = useState<"payment-link" | "signup" | null>(null);
  const processedPaymentLinkTokenRef = useRef<string | null>(null);
  const processedResumeIntentRef = useRef<string | null>(null);
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
    const raw = selectedRequest.amountRequested;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }, [selectedRequest]);

  const shouldLockAmount =
    selectedRequestAmount != null ? selectedRequestAmount > 0 : false;
  const updateRecipient = useCallback(
    (value: Hypodata | null | undefined) => {
      const normalised = value ?? null;
      setToSendData(normalised);
      onRecipientChange?.(normalised);
    },
    [onRecipientChange]
  );

  const applyRequestedAmount = useCallback(
    (amount: number | null | undefined) => {
      if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
        return;
      }
      const nextAmount = amount ?? 0;
      const cadNumeric = safeExchangeRate === 0 ? 0 : nextAmount * safeExchangeRate;
      setTcoinAmount(nextAmount.toFixed(2));
      setCadAmount(cadNumeric.toFixed(2));
    },
    [safeExchangeRate]
  );

  const applyResolvedPaymentLink = useCallback(
    (link: {
      token: string;
      amountRequested: number | null;
      recipient: {
        id: number;
        fullName: string | null;
        username: string | null;
        profileImageUrl: string | null;
        walletAddress: string | null;
      } | null;
    }) => {
      if (!link.recipient) {
        throw new Error("The pay link is missing recipient details.");
      }

      updateRecipient({
        id: link.recipient.id,
        full_name: link.recipient.fullName,
        username: link.recipient.username,
        profile_image_url: link.recipient.profileImageUrl,
        wallet_address: link.recipient.walletAddress,
        state: null,
      });
      applyRequestedAmount(link.amountRequested);
      setActiveAction("manual");
      setActivePaymentLinkToken(link.token);
      setPendingPaymentSource("payment-link");
    },
    [applyRequestedAmount, updateRecipient]
  );

  useEffect(() => {
    setToSendData(recipient);
  }, [recipient]);

  useEffect(() => {
    if (!paymentLinkToken) {
      processedPaymentLinkTokenRef.current = null;
      return;
    }

    if (processedPaymentLinkTokenRef.current === paymentLinkToken) {
      return;
    }

    processedPaymentLinkTokenRef.current = paymentLinkToken;

    void (async () => {
      try {
        const { link } = await resolvePaymentRequestLink(paymentLinkToken);
        if (link.state !== "ready") {
          toast.error("That pay link is no longer available.");
          return;
        }
        applyResolvedPaymentLink(link);
      } catch (error) {
        console.error("Failed to resolve payment link token:", error);
        toast.error("Failed to load the pay link.");
      }
    })();
  }, [applyResolvedPaymentLink, paymentLinkToken]);

  useEffect(() => {
    if (!resumePendingPayment || !pendingPaymentIntent) {
      processedResumeIntentRef.current = null;
      return;
    }

    const intentKey = `${pendingPaymentIntent.recipientUserId}:${pendingPaymentIntent.createdAt ?? ""}`;
    if (processedResumeIntentRef.current === intentKey) {
      return;
    }

    processedResumeIntentRef.current = intentKey;
    updateRecipient({
      id: pendingPaymentIntent.recipientUserId,
      full_name: pendingPaymentIntent.recipientName,
      username: pendingPaymentIntent.recipientUsername,
      profile_image_url: pendingPaymentIntent.recipientProfileImageUrl,
      wallet_address: pendingPaymentIntent.recipientWalletAddress,
      state: null,
    });
    applyRequestedAmount(pendingPaymentIntent.amountRequested);
    setActiveAction("manual");
    setActivePaymentLinkToken(pendingPaymentIntent.sourceToken);
    setPendingPaymentSource("signup");
  }, [applyRequestedAmount, pendingPaymentIntent, resumePendingPayment, updateRecipient]);

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
    setActivePaymentLinkToken(null);
    setPendingPaymentSource(null);
  }, [updateRecipient]);

  const fetchIncomingRequests = useCallback(async (): Promise<IncomingRequest[]> => {
    const currentUserId = userData?.cubidData?.id;
    if (!currentUserId) {
      setIncomingRequests([]);
      return [];
    }

    try {
      const body = await getIncomingPaymentRequests({
        appContext: { citySlug: "tcoin" },
      });

      const rows = (body.requests ?? []) as InvoicePayRequest[];
      const filtered = rows.filter((request) => {
        if (request.isActive === false) {
          return false;
        }

        if (CLOSED_REQUEST_STATUSES.has(request.status)) {
          return false;
        }

        return true;
      });

      const enriched = filtered.map((request) => {
        const requesterId = request.requestBy;
        const contactRequester =
          requesterId != null ? contactsById.get(requesterId) ?? null : null;
        const requester =
          contactRequester ??
          (requesterId != null
            ? ({
                id: requesterId,
                full_name: request.requesterFullName ?? undefined,
                username: request.requesterUsername ?? undefined,
                profile_image_url: request.requesterProfileImageUrl ?? undefined,
                wallet_address: request.requesterWalletPublicKey ?? undefined,
                state: undefined,
              } as Hypodata)
            : null);
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
      const requesterId = request.requestBy;
      let requester = request.requester ?? null;

      if (!requester && requesterId != null) {
        requester =
          contactsById.get(requesterId) ??
          ({
            id: requesterId,
            full_name: request.requesterFullName ?? undefined,
            username: request.requesterUsername ?? undefined,
            profile_image_url: request.requesterProfileImageUrl ?? undefined,
            wallet_address: request.requesterWalletPublicKey ?? undefined,
            state: undefined,
          } as Hypodata);
      }

      if (!requester) {
        toast.error("Unable to load the requester details for this request.");
        return;
      }

      updateRecipient(requester);

      const numericAmount =
        typeof request.amountRequested === "number"
          ? request.amountRequested
          : Number.parseFloat(String(request.amountRequested ?? "0"));
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
      setActiveAction("manual");
      setPayLink("");
    },
    [contactsById, safeExchangeRate, updateRecipient]
  );

  const handleIgnoreRequest = useCallback(
    async (request: IncomingRequest) => {
      try {
        await dismissPaymentRequest({
          requestId: request.id,
          appContext: { citySlug: "tcoin" },
        });

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

  const openRequestsPanel = useCallback(async () => {
    if (isLoadingRequests) return;
    setIsLoadingRequests(true);
    try {
      const requests = await fetchIncomingRequests();
      setIncomingRequests(requests);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [fetchIncomingRequests, isLoadingRequests]);

  const handleManualClick = () => {
    if (selectedRequest) {
      setSelectedRequest(null);
    }
    setActiveAction("manual");
  };

  const handleScanClick = () => {
    const hadRequest = Boolean(selectedRequest);
    if (hadRequest) {
      setSelectedRequest(null);
    }
    reset();
    setActiveAction("scan");
  };

  const handleLinkClick = () => {
    const hadRequest = Boolean(selectedRequest);
    if (hadRequest) {
      setSelectedRequest(null);
    }
    reset();
    setPayLink("");
    setActiveAction("link");
  };

  const handleRequestsClick = useCallback(() => {
    if (selectedRequest) {
      setSelectedRequest(null);
    }
    setActiveAction("requests");
    void openRequestsPanel();
  }, [openRequestsPanel, selectedRequest]);

  const handleRequestPaid = useCallback(
    async (details?: PaymentCompletionDetails) => {
      if (!selectedRequest) return;
      const requestId = selectedRequest.id;
      try {
        await markPaymentRequestPaid({
          requestId,
          transactionId: resolveTransactionId(details) ?? null,
          appContext: { citySlug: "tcoin" },
        });
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

  const handleLinkedPaymentComplete = useCallback(
    async (details?: PaymentCompletionDetails) => {
      const tokenToConsume = activePaymentLinkToken;
      const transactionId = resolveTransactionId(details);
      const shouldClearPendingIntent = pendingPaymentSource === "signup";

      if (selectedRequest) {
        await handleRequestPaid(details);
      }

      if (tokenToConsume) {
        try {
          await consumePaymentRequestLink({
            token: tokenToConsume,
            transactionId,
            appContext: { citySlug: "tcoin" },
          });
        } catch (error) {
          console.error("Failed to consume payment link:", error);
        }
      }

      if (shouldClearPendingIntent) {
        try {
          await clearPendingPaymentIntent.mutateAsync();
        } catch (error) {
          console.error("Failed to clear pending payment intent:", error);
        }
      }

      setActivePaymentLinkToken(null);
      setPendingPaymentSource(null);
    },
    [
      activePaymentLinkToken,
      clearPendingPaymentIntent,
      handleRequestPaid,
      pendingPaymentSource,
      selectedRequest,
    ]
  );

  useEffect(() => {
    if (!toSendData && selectedRequest) {
      setSelectedRequest(null);
    }
  }, [selectedRequest, toSendData]);

  useEffect(() => {
    void fetchIncomingRequests();
  }, [fetchIncomingRequests]);

  useEffect(() => {
    if (!isCheckingCamera && !hasCamera && activeAction === "scan") {
      setActiveAction("manual");
    }
  }, [activeAction, hasCamera, isCheckingCamera]);

  const applyLegacyPayPayload = useCallback(
    async (payload: Record<string, unknown>) => {
      const nanoId =
        typeof payload.nano_id === "string" && payload.nano_id.trim()
          ? payload.nano_id.trim()
          : null;
      const qrTcoinAmount =
        typeof payload.qrTcoinAmount === "string" ? payload.qrTcoinAmount : null;

      if (!nanoId) {
        throw new Error("Invalid pay link");
      }

      const lookup = await lookupWalletUserByIdentifier(
        { userIdentifier: nanoId },
        { citySlug: "tcoin" }
      );
      updateRecipient(
        lookup.user
          ? {
              id: lookup.user.id,
              full_name: lookup.user.fullName,
              username: lookup.user.username,
              profile_image_url: lookup.user.profileImageUrl,
              wallet_address: lookup.user.walletAddress,
              state: lookup.user.state,
            }
          : null
      );

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

      setActiveAction("manual");
      setActivePaymentLinkToken(null);
      setPendingPaymentSource(null);
    },
    [safeExchangeRate, updateRecipient]
  );

  const handlePayLink = async () => {
    try {
      const paymentToken = extractWalletPayToken(payLink);
      if (paymentToken) {
        const { link } = await resolvePaymentRequestLink(paymentToken);
        if (link.state !== "ready") {
          toast.error("That pay link is no longer available.");
          return;
        }
        applyResolvedPaymentLink(link);
        return;
      }

      const decoded = decodeLegacyWalletPayPayload(payLink);
      if (!decoded) {
        toast.error("Invalid pay link");
        return;
      }

      await applyLegacyPayPayload(decoded);
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
      {hasCamera ? (
        <Button
          type="button"
          variant={activeAction === "scan" ? "default" : "outline"}
          onClick={handleScanClick}
          className="min-w-[120px]"
        >
          Scan QR Code
        </Button>
      ) : null}
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
        onClick={handleRequestsClick}
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
    <div data-testid="send-tab-layout" className="space-y-4">
      <section className="rounded-2xl border border-border bg-card/70 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2">{modeActions}</div>
      </section>

      {activeAction === "manual" && (
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
          locked={lockRecipient}
          actionLabel={selectedRequest ? "Pay this request" : "Send..."}
          getLastTransferRecord={getLastTransferRecord}
          onPaymentComplete={
            selectedRequest || activePaymentLinkToken || pendingPaymentSource
              ? handleLinkedPaymentComplete
              : undefined
          }
          lockRecipient={lockRecipient}
          lockAmount={lockAmount}
          recipientHeading={recipientHeading}
        />
      )}

      {activeAction === "scan" && hasCamera && (
        <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Scan QR</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan a payment QR code to load recipient and amount details.
          </p>
          <div className="mt-4">
            <QrScanModal
              closeModal={() => setActiveAction("manual")}
              setToSendData={(d: Hypodata) => updateRecipient(d)}
              setTcoin={setTcoinAmount}
              setCad={setCadAmount}
              onResolvedPaymentLink={(link: PaymentRequestLinkResolution) => {
                applyResolvedPaymentLink(link);
              }}
              onResolvedLegacyPayload={() => {
                setActivePaymentLinkToken(null);
                setPendingPaymentSource(null);
                setActiveAction("manual");
              }}
            />
          </div>
        </section>
      )}

      {activeAction === "link" && (
        <>
          {!toSendData ? (
            <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Pay Link</h2>
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
              getLastTransferRecord={getLastTransferRecord}
              onPaymentComplete={handleLinkedPaymentComplete}
            />
          )}
        </>
      )}

      {activeAction === "requests" && (
        <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Incoming Requests To Pay</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void openRequestsPanel();
              }}
              disabled={isLoadingRequests}
            >
              Refresh
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a request to pay or ignore. Ignored requests are archived.
          </p>
          <div className="mt-4">
            {isLoadingRequests ? (
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            ) : (
              <RequestsList
                requests={incomingRequests}
                onSelect={(selection) => {
                  void handleRequestSelection(selection);
                }}
                onIgnore={(request) => handleIgnoreRequest(request)}
              />
            )}
          </div>
        </section>
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
        const createdLabel = request.createdAt
          ? new Date(request.createdAt).toLocaleDateString("en-CA")
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
                  {formatRequestAmount(request.amountRequested)}
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
