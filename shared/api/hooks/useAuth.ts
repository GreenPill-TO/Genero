import { createClient } from "@shared/lib/supabase/client";
import { Session } from "@supabase/supabase-js";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { triggerIndexerTouch } from "@shared/lib/indexer/trigger";
import { setSessionSnapshot } from "@shared/lib/supabase/session";
import { fetchCubidData } from "../services/cubidService";
import { fetchCubidDataFromSupabase, fetchUserByContact, getSession, signOut, updateCubidDataInSupabase } from "../services/supabaseService";

const sharedAuthSubscription = {
  refCount: 0,
  unsubscribe: null as null | (() => void),
  queryClients: new Map<QueryClient, number>(),
};

export function resetUseAuthSubscriptionForTests() {
  sharedAuthSubscription.unsubscribe?.();
  sharedAuthSubscription.refCount = 0;
  sharedAuthSubscription.unsubscribe = null;
  sharedAuthSubscription.queryClients.clear();
}

function syncAuthStateForClient(queryClient: QueryClient, session: Session | null) {
  queryClient.setQueryData(["auth-data"], session ?? null);

  if (session) {
    queryClient.invalidateQueries({ queryKey: ["user-data"] });
  } else {
    queryClient.removeQueries({ queryKey: ["user-data"] });
  }
}

function broadcastAuthState(event: string, session: Session | null) {
  setSessionSnapshot(session ?? null);

  sharedAuthSubscription.queryClients.forEach((_, queryClient) => {
    syncAuthStateForClient(queryClient, session);
  });

  if (session && event === "SIGNED_IN") {
    void triggerIndexerTouch().catch(() => {
      // Indexer trigger is best-effort and should not affect auth flow.
    });
  }
}

function trackQueryClient(queryClient: QueryClient) {
  sharedAuthSubscription.queryClients.set(
    queryClient,
    (sharedAuthSubscription.queryClients.get(queryClient) ?? 0) + 1
  );
}

function releaseSharedAuthSubscription(queryClient: QueryClient) {
  sharedAuthSubscription.refCount = Math.max(0, sharedAuthSubscription.refCount - 1);
  const nextClientRefCount = (sharedAuthSubscription.queryClients.get(queryClient) ?? 0) - 1;

  if (nextClientRefCount > 0) {
    sharedAuthSubscription.queryClients.set(queryClient, nextClientRefCount);
  } else {
    sharedAuthSubscription.queryClients.delete(queryClient);
  }

  if (sharedAuthSubscription.refCount === 0) {
    sharedAuthSubscription.unsubscribe?.();
    sharedAuthSubscription.unsubscribe = null;
    sharedAuthSubscription.queryClients.clear();
  }
}

// Custom hook for authentication, fetching user, and handling Cubid data
export const useAuth = () => {
  const queryClient = useQueryClient();

  // Fetch session data
  const authQuery = useQuery<Session | null>({
    queryKey: ["auth-data"],
    queryFn: getSession,
  });

  const cubidDataFetched = useRef(false); // To avoid repeated fetching

  useEffect(() => {
    sharedAuthSubscription.refCount += 1;
    trackQueryClient(queryClient);

    if (!sharedAuthSubscription.unsubscribe) {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        broadcastAuthState(event, session);
      });

      sharedAuthSubscription.unsubscribe = () => {
        subscription.unsubscribe();
      };
    }

    return () => {
      releaseSharedAuthSubscription(queryClient);
    };
  }, [queryClient]);

  const accessToken = authQuery.data?.access_token?.trim() ?? null;

  useEffect(() => {
    if (!accessToken) {
      cubidDataFetched.current = false;
    }
  }, [accessToken]);

  // Fetch user and Cubid data from Supabase and handle 24-hour update logic
  const userQuery = useQuery({
    queryKey: ["user-data"],
    queryFn: async () => {
      try {
        const { user, error: ensuredUserError } = await fetchUserByContact(
          authQuery?.data?.user?.app_metadata?.provider || "email",
          authQuery?.data?.user?.email || ""
        );

        if (ensuredUserError) {
          throw ensuredUserError;
        }

        if (!user) {
          return null;
        }

        const cubidData = await fetchCubidDataFromSupabase();

        const now = new Date();
        const lastUpdated = cubidData.updated_at ? new Date(cubidData.updated_at) : new Date(0);
        const timeDifference = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
        const shouldRefreshCubidData =
          typeof cubidData.cubid_id === "string" &&
          cubidData.cubid_id.length > 0 &&
          typeof cubidData.auth_user_id === "string" &&
          cubidData.auth_user_id.length > 0 &&
          cubidData.auth_user_id !== cubidData.cubid_id;

        if (timeDifference > 24 && shouldRefreshCubidData && !cubidDataFetched.current) {
          try {
            const cubidId = cubidData.cubid_id;
            if (!cubidId) {
              return { user, cubidData };
            }

            const apiData = await fetchCubidData(cubidId);
            await updateCubidDataInSupabase({
              user: {
                cubid_score: apiData.score,
                cubid_identity: apiData.identity,
                cubid_score_details: apiData.scoreDetails,
                updated_at: new Date().toISOString(),
              },
            });

            cubidDataFetched.current = true;
            queryClient.invalidateQueries({ queryKey: ["user-data"] });
          } catch (cubidRefreshError) {
            console.warn("Cubid refresh failed; continuing with stored user data.", cubidRefreshError);
          }
        }
        return { user, cubidData };
      } catch (error) {
        // Log the error explicitly to the console
        console.error("Error in fetching authenticated user identity data:", error);
        throw error; // React Query will handle it
      }
    },
    enabled: Boolean(accessToken), // Only fetch if authenticated
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-data"] });
      toast.success("Signed out!");
    },
    onError: () => {
      toast.error("Failed to sign out!");
    },
  });

  return {
    authData: authQuery.data,
    userData: userQuery.data,
    isAuthenticated: Boolean(accessToken),
    error: userQuery.error || authQuery.error,
    isLoading: authQuery.isLoading || userQuery.isLoading,
    isLoadingUser: userQuery.isLoading,
    signOut: signOutMutation.mutate,
  };
};
