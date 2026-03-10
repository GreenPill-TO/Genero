"use client";

import { useCallback, useEffect } from "react";
import { triggerIndexerTouch } from "@shared/lib/indexer/trigger";

export function useIndexerTrigger(options?: {
  citySlug?: string;
  enabled?: boolean;
  heartbeatMs?: number;
}) {
  const enabled = options?.enabled ?? true;
  const heartbeatMs = options?.heartbeatMs ?? 60_000;

  const touch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      await triggerIndexerTouch({ citySlug: options?.citySlug });
    } catch {
      // Best-effort trigger only.
    }
  }, [enabled, options?.citySlug]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void touch();

    const intervalId = window.setInterval(() => {
      void touch();
    }, heartbeatMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void touch();
      }
    };

    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, heartbeatMs, touch]);

  return {
    triggerNow: touch,
  };
}
