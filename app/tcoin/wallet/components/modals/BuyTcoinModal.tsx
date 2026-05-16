import React, { useEffect, useMemo, useRef, useState } from "react";
import { LuRefreshCcw } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import {
  createOnrampSession,
  getOnrampSession,
  touchOnrampSessions,
  updateOnrampSession,
} from "@shared/lib/edge/onrampClient";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import type { OnrampCheckoutSession } from "@shared/lib/onramp/types";

type BuyTcoinModalProps = {
  closeModal: () => void;
};

type CheckoutErrorState = {
  message: string;
  technical: string | null;
};

const CELOSCAN_TX_PREFIX = "https://celoscan.io/tx/";

function statusTone(status: OnrampCheckoutSession["status"]): string {
  switch (status) {
    case "mint_complete":
      return "text-green-600";
    case "failed":
    case "manual_review":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

function sanitizeNumeric(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

function formatTcoinDisplay(value: string): string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return "0.00";
  }
  return num.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCadDisplay(value: string): string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) {
    return "$0.00";
  }
  return `$${num.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toUserFacingCheckoutError(rawError: string): string {
  const normalized = rawError.trim().toLowerCase();

  if (normalized.includes("invalid hex bytes value") || normalized.includes("private key")) {
    return "Buy TCOIN checkout is temporarily unavailable due to server configuration. Use Interac top-up for now, or contact support.";
  }

  if (normalized.includes("no evm wallet")) {
    return "Connect your wallet before starting Buy TCOIN checkout.";
  }

  if (normalized.includes("unauthorized")) {
    return "Your session expired. Please sign in again and retry.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Could not reach checkout services. Check your connection and try again.";
  }

  return rawError;
}

export function BuyTcoinModal({ closeModal }: BuyTcoinModalProps) {
  const [inputMode, setInputMode] = useState<"tcoin" | "cad">("tcoin");
  const [tcoinAmount, setTcoinAmount] = useState("100");
  const [cadAmount, setCadAmount] = useState("");
  const [countryCode, setCountryCode] = useState("CA");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [session, setSession] = useState<OnrampCheckoutSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutErrorState | null>(null);
  const [showTechnicalError, setShowTechnicalError] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const previousStatusRef = useRef<OnrampCheckoutSession["status"] | null>(null);
  const { exchangeRate, fallbackMessage } = useControlVariables();

  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;

  const isTerminal =
    session?.status === "mint_complete" || session?.status === "failed" || session?.status === "manual_review";

  const canStart = !isCreating && !sessionId;

  useEffect(() => {
    if (inputMode !== "tcoin") {
      return;
    }

    const parsedTcoin = Number.parseFloat(tcoinAmount);
    if (!Number.isFinite(parsedTcoin) || safeExchangeRate <= 0) {
      setCadAmount("");
      return;
    }

    setCadAmount((parsedTcoin * safeExchangeRate).toFixed(2));
  }, [inputMode, safeExchangeRate, tcoinAmount]);

  const handleTcoinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeNumeric(event.target.value);
    setTcoinAmount(sanitized);

    const parsed = Number.parseFloat(sanitized);
    if (!Number.isFinite(parsed) || safeExchangeRate <= 0) {
      setCadAmount("");
      return;
    }

    setCadAmount((parsed * safeExchangeRate).toFixed(2));
  };

  const handleCadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeNumeric(event.target.value);
    setCadAmount(sanitized);

    const parsed = Number.parseFloat(sanitized);
    if (!Number.isFinite(parsed) || safeExchangeRate <= 0) {
      setTcoinAmount("");
      return;
    }

    setTcoinAmount((parsed / safeExchangeRate).toFixed(2));
  };

  const handleAmountBlur = () => {
    if (inputMode === "tcoin") {
      const parsed = Number.parseFloat(tcoinAmount);
      if (!Number.isFinite(parsed)) {
        setTcoinAmount("");
        setCadAmount("");
        return;
      }
      setTcoinAmount(parsed.toFixed(2));
      if (safeExchangeRate > 0) {
        setCadAmount((parsed * safeExchangeRate).toFixed(2));
      }
      return;
    }

    const parsed = Number.parseFloat(cadAmount);
    if (!Number.isFinite(parsed)) {
      setCadAmount("");
      setTcoinAmount("");
      return;
    }
    setCadAmount(parsed.toFixed(2));
    if (safeExchangeRate > 0) {
      setTcoinAmount((parsed / safeExchangeRate).toFixed(2));
    }
  };

  const checkoutFiatAmount = useMemo(() => {
    if (inputMode === "cad") {
      return Number.parseFloat(cadAmount);
    }
    const parsedTcoin = Number.parseFloat(tcoinAmount);
    if (!Number.isFinite(parsedTcoin) || safeExchangeRate <= 0) {
      return Number.NaN;
    }
    return parsedTcoin * safeExchangeRate;
  }, [cadAmount, inputMode, safeExchangeRate, tcoinAmount]);

  const startCheckout = async () => {
    if (!Number.isFinite(checkoutFiatAmount) || checkoutFiatAmount <= 0) {
      const reason =
        inputMode === "tcoin" && safeExchangeRate <= 0
          ? "Exchange rate is unavailable. Switch to CAD input or try again shortly."
          : "Enter a valid amount to start checkout.";
      toast.error(reason);
      setCheckoutError({ message: reason, technical: null });
      setShowTechnicalError(false);
      return;
    }

    const normalizedCountryCode = countryCode.trim().toUpperCase();
    if (normalizedCountryCode.length < 2) {
      const reason = "Country code must be at least 2 letters (for example, CA).";
      toast.error(reason);
      setCheckoutError({ message: reason, technical: null });
      setShowTechnicalError(false);
      return;
    }

    setIsCreating(true);
    setCheckoutError(null);
    setShowTechnicalError(false);

    try {
      const body = await createOnrampSession(
        {
          fiatAmount: Number(checkoutFiatAmount.toFixed(2)),
          fiatCurrency: "CAD",
          countryCode: normalizedCountryCode,
        },
        { citySlug: "tcoin" }
      );

      if (body.state !== "ready") {
        const reason =
          typeof body.message === "string" && body.message ? body.message : "Buy TCOIN checkout is currently unavailable.";
        const technical =
          body.state === "misconfigured" && typeof body.technicalError === "string" ? body.technicalError : null;
        setCheckoutError({ message: reason, technical });
        setShowTechnicalError(false);
        toast.error(reason);
        return;
      }

      setSessionId(body.sessionId);
      setWidgetUrl(body.widgetUrl);
      toast.info("Checkout session created. Complete payment in the embedded widget.");

      await updateOnrampSession(body.sessionId, { action: "widget_opened" }, { citySlug: "tcoin" }).catch(
        () => undefined
      );
    } catch (error) {
      const technical = error instanceof Error ? error.message : "Failed to create checkout session.";
      const userMessage = toUserFacingCheckoutError(technical);

      setCheckoutError({
        message: userMessage,
        technical: technical !== userMessage ? technical : null,
      });
      setShowTechnicalError(false);
      toast.error(userMessage);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!sessionId || isTerminal) {
      setIsPolling(false);
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        setIsPolling(true);
        const [statusBody] = await Promise.all([
          getOnrampSession(sessionId, { citySlug: "tcoin" }),
          touchOnrampSessions({ citySlug: "tcoin" }).catch(() => undefined),
        ]);

        if (!statusBody.session) {
          return;
        }

        const previousStatus = previousStatusRef.current;
        previousStatusRef.current = statusBody.session.status;
        setSession(statusBody.session);

        if (previousStatus !== statusBody.session.status) {
          if (statusBody.session.status === "mint_started") {
            toast.info("Router buy in progress...");
          } else if (statusBody.session.status === "mint_complete") {
            toast.success("cplTCOIN delivered.");
          } else if (statusBody.session.status === "manual_review") {
            toast.warning("This checkout needs manual review. Admin will retry automatically.");
          } else if (statusBody.session.status === "failed") {
            toast.error("Checkout failed. Please retry or use Interac fallback.");
          }
        }
      } finally {
        setIsPolling(false);
      }
    };

    void poll();
    pollTimerRef.current = window.setInterval(() => {
      void poll();
    }, 6_000);

    return () => {
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isTerminal]);

  const footer = useMemo(() => {
    if (!session) {
      return "Fallback: use Top Up with Interac eTransfer if checkout is unavailable in your region.";
    }

    if (session.status === "mint_complete") {
      return `Completed. Your wallet should now reflect updated ${session.finalTokenSymbol ?? "cplTCOIN"} balance.`;
    }

    if (session.status === "manual_review") {
      return "Manual review is in progress. If delayed, contact support with your session id.";
    }

    return "This flow is atomic once router execution starts: either cplTCOIN arrives, or the router transaction reverts.";
  }, [session]);

  const conversionPreview =
    inputMode === "tcoin"
      ? `≈ ${formatCadDisplay(cadAmount)} CAD`
      : `≈ ${formatTcoinDisplay(tcoinAmount)} cplTCOIN`;

  return (
    <div className="space-y-4 font-sans">
      {!sessionId && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pay with fiat through Transak. Funds route to USDC on Celo, then acquire cplTCOIN through the TorontoCoin liquidity router.
          </p>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkout amount</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Toggle amount input between cplTCOIN and CAD"
                onClick={() => setInputMode((prev) => (prev === "tcoin" ? "cad" : "tcoin"))}
              >
                <LuRefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="buy-tcoin-amount">
                {inputMode === "tcoin" ? "Amount in cplTCOIN" : "Amount in CAD"}
              </label>
              <Input
                id="buy-tcoin-amount"
                value={inputMode === "tcoin" ? tcoinAmount : cadAmount}
                onChange={inputMode === "tcoin" ? handleTcoinChange : handleCadChange}
                onBlur={handleAmountBlur}
                placeholder={inputMode === "tcoin" ? "0.00" : "0.00"}
                type="text"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">{conversionPreview}</p>
              {inputMode === "tcoin" && fallbackMessage ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{fallbackMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="buy-tcoin-currency">
                Checkout currency
              </label>
              <Input id="buy-tcoin-currency" value="CAD" readOnly aria-readonly="true" />
              <p className="text-xs text-muted-foreground">
                Fixed to CAD for Buy TCOIN checkout quotes in this version.
              </p>
              <p className="text-xs text-muted-foreground">
                Settlement uses USDC on Celo as input and delivers cplTCOIN to your wallet.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="buy-tcoin-country">
                Country code
              </label>
              <Input
                id="buy-tcoin-country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                placeholder="CA"
                maxLength={2}
              />
              <p className="text-xs text-muted-foreground">
                Used by Transak for payment-method availability and compliance. Default is CA (Canada).
              </p>
            </div>
          </div>

          {checkoutError && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200">
              <p className="text-sm">{checkoutError.message}</p>
              {checkoutError.technical && (
                <div className="mt-2 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTechnicalError((prev) => !prev)}
                  >
                    {showTechnicalError ? "Hide technical details" : "Show technical details"}
                  </Button>
                  {showTechnicalError && (
                    <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded bg-black/10 p-2 text-xs dark:bg-black/30">
                      {checkoutError.technical}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Close
            </Button>
            <Button type="button" onClick={() => void startCheckout()} disabled={!canStart}>
              {isCreating ? "Starting..." : "Open Checkout"}
            </Button>
          </div>
        </div>
      )}

      {sessionId && (
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-xs">
            <p>
              <span className="font-semibold">Session:</span> {sessionId}
            </p>
            <p className={statusTone(session?.status ?? "created")}>
              <span className="font-semibold">Status:</span> {session?.status ?? "created"}
              {isPolling ? " (syncing...)" : ""}
            </p>
          </div>

          {widgetUrl ? (
            <div className="overflow-hidden rounded-md border">
              <iframe
                src={widgetUrl}
                title="Buy cplTCOIN checkout"
                className="h-[520px] w-full"
                allow="clipboard-write; payment"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for widget URL...</p>
          )}

          {session?.timeline && session.timeline.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checkout Progress
              </p>
              <ul className="space-y-1 text-sm">
                {session.timeline.map((step) => (
                  <li key={step.key} className={step.reached ? "text-foreground" : "text-muted-foreground"}>
                    {step.reached ? "●" : "○"} {step.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 text-xs text-muted-foreground">
            {session?.incomingUsdcTxHash && (
              <a
                className="underline"
                href={`${CELOSCAN_TX_PREFIX}${session.incomingUsdcTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Incoming USDC tx
              </a>
            )}
            {(session?.routerTxHash ?? session?.mintTxHash) && (
              <a
                className="underline"
                href={`${CELOSCAN_TX_PREFIX}${session.routerTxHash ?? session.mintTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Router tx
              </a>
            )}
            {session?.tcoinDeliveryTxHash && session.tcoinDeliveryTxHash !== (session.routerTxHash ?? session.mintTxHash) && (
              <a
                className="underline"
                href={`${CELOSCAN_TX_PREFIX}${session.tcoinDeliveryTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Delivery tx
              </a>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{footer}</p>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSessionId(null);
                setWidgetUrl(null);
                setSession(null);
                setCheckoutError(null);
                setShowTechnicalError(false);
                previousStatusRef.current = null;
              }}
            >
              Start New Checkout
            </Button>
            <Button type="button" onClick={closeModal}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
