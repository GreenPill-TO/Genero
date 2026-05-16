"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/api/hooks/useAuth";
import { getWalletCustodyMaterial } from "@shared/lib/edge/userSettingsClient";

function resolveCurrentWalletAddress(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (
    value &&
    typeof value === "object" &&
    "publicKey" in value &&
    typeof (value as { publicKey?: unknown }).publicKey === "string"
  ) {
    const publicKey = (value as { publicKey: string }).publicKey.trim();
    return publicKey.length > 0 ? publicKey : null;
  }

  return null;
}

export function useCurrentWalletAddress(options?: { enabled?: boolean; citySlug?: string }) {
  const { userData, isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const citySlug = options?.citySlug ?? (process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin");

  const userId = useMemo(() => {
    const raw = userData?.cubidData?.id;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [userData?.cubidData?.id]);

  const query = useQuery({
    queryKey: ["current-wallet-address", citySlug, userId],
    enabled: enabled && isAuthenticated && userId != null,
    queryFn: async () => {
      const custody = await getWalletCustodyMaterial({ citySlug });
      return resolveCurrentWalletAddress(custody.primaryWallet);
    },
  });

  return {
    walletAddress: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refreshWalletAddress: query.refetch,
  };
}
