import { useEffect, useState } from "react";
import { createClient } from "@shared/lib/supabase/client";

interface ControlVariable {
  value?: number;
}

interface UseControlVariablesOptions {
  isBrowser?: boolean;
}

export function useControlVariables(options?: UseControlVariablesOptions) {
  const isBrowser = options?.isBrowser ?? typeof window !== "undefined";
  const [data, setData] = useState<ControlVariable | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(isBrowser);

  useEffect(() => {
    let isActive = true;

    async function fetchControlVariables() {
      try {
        const supabase = createClient();
        const { data: controlData, error } = await supabase
          .from("control_variables")
          .select("*")
          .match({ variable: "exchange_rate" });

        if (!isActive) {
          return;
        }

        const canDispatch = typeof window !== "undefined";

        if (error) {
          if (canDispatch) {
            setError(error);
          }
          return;
        }

        if (canDispatch) {
          setData(controlData?.[0] ?? null);
        }
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        if (typeof window !== "undefined") {
          setError(caughtError);
        }
      } finally {
        if (isActive && isBrowser && typeof window !== "undefined") {
          setLoading(false);
        }
      }
    }

    if (!isBrowser) {
      return () => {
        isActive = false;
      };
    }

    fetchControlVariables();

    return () => {
      isActive = false;
    };
  }, [isBrowser]);

  return { exchangeRate: data?.value ?? 3.35, error, loading };
}
