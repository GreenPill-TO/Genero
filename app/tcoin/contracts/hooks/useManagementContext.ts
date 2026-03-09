// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { createClient } from "@shared/lib/supabase/client";
import { resolveManagementRoles } from "@shared/lib/contracts/management/roles";

export function useManagementContext(citySlug?: string) {
  const { userData, isLoading: isAuthLoading } = useAuth();
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [context, setContext] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = useMemo(() => {
    const raw = userData?.cubidData?.id;
    return typeof raw === "number" ? raw : null;
  }, [userData?.cubidData?.id]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isAuthLoading) {
        return;
      }

      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: walletError } = await supabase
          .from("wallet_list")
          .select("public_key")
          .match({ user_id: userId, namespace: "EVM" })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (walletError) {
          throw new Error(walletError.message);
        }

        if (!data?.public_key) {
          throw new Error("No Cubid EVM wallet found for current user.");
        }

        const address = data.public_key as `0x${string}`;
        const roleData = await resolveManagementRoles({ walletAddress: address, citySlug });

        if (!cancelled) {
          setWalletAddress(address);
          setRoles(roleData.roles);
          setFlags(roleData.flags);
          setContext(roleData.context);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to resolve management context.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [citySlug, isAuthLoading, userId]);

  return {
    userId,
    walletAddress,
    roles,
    flags,
    context,
    loading,
    error,
  };
}
