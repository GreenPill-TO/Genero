import { useEffect, useState } from "react";
import { createClient } from "@shared/lib/supabase/client";

interface ControlVariable {
  value?: number;
}

interface UseControlVariablesOptions {
  isBrowser?: boolean;
}

export function useControlVariables(options?: UseControlVariablesOptions) {
  const [data, setData] = useState<ControlVariable | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const isBrowser = options?.isBrowser ?? typeof window !== "undefined";

  useEffect(() => {
    let isActive = true;

    async function fetchControlVariables() {
      if (!isBrowser) {
        if (isActive) {
          setLoading(false);
        }
        return;
      }

      try {
        const supabase = createClient();
        const { data: controlData, error } = await supabase
          .from("control_variables")
          .select("*")
          .match({ variable: "exchange_rate" });

        if (!isActive) {
          return;
        }

        if (error) {
          setError(error);
          return;
        }

        setData(controlData?.[0] ?? null);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setError(caughtError);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchControlVariables();

    return () => {
      isActive = false;
    };
  }, [isBrowser]);

  return { exchangeRate: data?.value ?? 3.35, error, loading };
}
