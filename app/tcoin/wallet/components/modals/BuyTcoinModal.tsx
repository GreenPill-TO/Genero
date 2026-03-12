import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import type { CreateOnrampSessionResponse, OnrampCheckoutSession } from "@shared/lib/onramp/types";

type BuyTcoinModalProps = {
  closeModal: () => void;
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

export function BuyTcoinModal({ closeModal }: BuyTcoinModalProps) {
  const [fiatAmount, setFiatAmount] = useState("100");
  const [fiatCurrency, setFiatCurrency] = useState("CAD");
  const [countryCode, setCountryCode] = useState("CA");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [session, setSession] = useState<OnrampCheckoutSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const previousStatusRef = useRef<OnrampCheckoutSession["status"] | null>(null);

  const isTerminal =
    session?.status === "mint_complete" || session?.status === "failed" || session?.status === "manual_review";

  const canStart = !isCreating && !sessionId;

  const startCheckout = async () => {
    const amount = Number.parseFloat(fiatAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid fiat amount.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/onramp/session", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fiatAmount: amount,
          fiatCurrency,
          countryCode,
          citySlug: "tcoin",
        }),
      });

      const body = (await response.json()) as
        | CreateOnrampSessionResponse
        | { error?: string; fallback?: string };

      if (!response.ok) {
        const reason = "error" in body && typeof body.error === "string"
          ? body.error
          : "Could not create checkout session.";
        throw new Error(reason);
      }

      if (!("sessionId" in body) || !("widgetUrl" in body)) {
        throw new Error("Unexpected checkout session response.");
      }

      setSessionId(body.sessionId);
      setWidgetUrl(body.widgetUrl);
      toast.info("Checkout session created. Complete payment in the embedded widget.");

      await fetch(`/api/onramp/session/${body.sessionId}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ citySlug: "tcoin", action: "widget_opened" }),
      }).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create checkout session.";
      toast.error(message);
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
        const [statusResp] = await Promise.all([
          fetch(`/api/onramp/session/${sessionId}?citySlug=tcoin`, {
            credentials: "include",
          }),
          fetch("/api/onramp/touch", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ citySlug: "tcoin" }),
          }).catch(() => undefined),
        ]);

        const statusBody = (await statusResp.json()) as {
          session?: OnrampCheckoutSession;
          error?: string;
        };

        if (!statusResp.ok || !statusBody.session) {
          return;
        }

        const previousStatus = previousStatusRef.current;
        previousStatusRef.current = statusBody.session.status;
        setSession(statusBody.session);

        if (previousStatus !== statusBody.session.status) {
          if (statusBody.session.status === "mint_started") {
            toast.info("Mint in progress...");
          } else if (statusBody.session.status === "mint_complete") {
            toast.success("TCOIN mint complete.");
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
      return "Completed. Your wallet should now reflect updated TCOIN balance.";
    }

    if (session.status === "manual_review") {
      return "Manual review is in progress. If delayed, contact support with your session id.";
    }

    return "This flow is atomic once mint starts: either TCOIN arrives, or mint transaction reverts.";
  }, [session]);

  return (
    <div className="space-y-4">
      {!sessionId && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Buy TCOIN</h3>
          <p className="text-sm text-muted-foreground">
            Pay with fiat through Transak. Funds route to USDC on Celo, then mint to TCOIN automatically.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={fiatAmount}
              onChange={(event) => setFiatAmount(event.target.value)}
              placeholder="Amount"
              type="number"
              inputMode="decimal"
            />
            <Input
              value={fiatCurrency}
              onChange={(event) => setFiatCurrency(event.target.value.toUpperCase())}
              placeholder="Currency (e.g. CAD)"
            />
            <Input
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
              placeholder="Country (e.g. CA)"
            />
          </div>
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
                title="Buy TCOIN checkout"
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
            {session?.mintTxHash && (
              <a
                className="underline"
                href={`${CELOSCAN_TX_PREFIX}${session.mintTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Mint tx
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
