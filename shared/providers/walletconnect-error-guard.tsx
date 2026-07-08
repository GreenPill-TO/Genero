"use client";

import { useEffect, useRef } from "react";

const DISCONNECT_ERROR_SNIPPET = "this.provider.disconnect is not a function";

const resolveErrorMessage = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
};

const resolveErrorStack = (value: unknown): string => {
  if (value && typeof value === "object" && "stack" in value) {
    const stack = (value as { stack?: unknown }).stack;
    if (typeof stack === "string") {
      return stack;
    }
  }

  return "";
};

const isWalletConnectDisconnectError = (value: unknown): boolean => {
  const message = resolveErrorMessage(value).toLowerCase();
  if (!message.includes(DISCONNECT_ERROR_SNIPPET)) {
    return false;
  }

  const stack = resolveErrorStack(value).toLowerCase();
  return stack.includes("@walletconnect") || stack.includes("walletconnect");
};

export function WalletConnectErrorGuard() {
  const didWarn = useRef(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const candidate = event.error ?? event.message;
      if (!isWalletConnectDisconnectError(candidate)) {
        return;
      }

      event.preventDefault();
      if (!didWarn.current) {
        console.warn(
          "[walletconnect] Suppressed known transport disconnect error (`provider.disconnect` missing)."
        );
        didWarn.current = true;
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isWalletConnectDisconnectError(event.reason)) {
        return;
      }

      event.preventDefault();
      if (!didWarn.current) {
        console.warn(
          "[walletconnect] Suppressed known unhandled disconnect rejection (`provider.disconnect` missing)."
        );
        didWarn.current = true;
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

