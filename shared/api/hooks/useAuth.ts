import { createClient } from "@shared/lib/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { fetchCubidData } from "../services/cubidService";
import { fetchCubidDataFromSupabase, fetchUserByContact, getSession, signOut, updateCubidDataInSupabase } from "../services/supabaseService";

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
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      queryClient.setQueryData(["auth-data"], session ?? null);

      if (session) {
        queryClient.invalidateQueries({ queryKey: ["user-data"] });
      } else {
        cubidDataFetched.current = false;
        queryClient.removeQueries({ queryKey: ["user-data"] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Fetch user and Cubid data from Supabase and handle 24-hour update logic
  const userQuery = useQuery({
    queryKey: ["user-data"],
    queryFn: async () => {
      try {
        const { user } = await fetchUserByContact(authQuery?.data?.user?.app_metadata?.provider || "email", authQuery?.data?.user?.email || "");
        if (!user?.cubid_id) {
          console.error("Invalid cubid_id");
          return null;
        }

        const cubidData = await fetchCubidDataFromSupabase(user?.cubid_id);

        const now = new Date();
        const lastUpdated = new Date(cubidData.updated_at);
        const timeDifference = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

        if (timeDifference > 24 && !cubidDataFetched.current) {
          // Fetch new Cubid data and update Supabase if it has been more than 24 hours
          const apiData = await fetchCubidData(user?.cubid_id);
          // Update Supabase with new Cubid data
          await updateCubidDataInSupabase(user?.cubid_id, {
            cubid_score: apiData.score,
            cubid_identity: apiData.identity,
            cubid_score_details: apiData.scoreDetails,
            updated_at: new Date(),
          });

          cubidDataFetched.current = true;
          queryClient.invalidateQueries({ queryKey: ["user-data"] }); // Invalidate to fetch fresh data
        }
        return { user, cubidData };
      } catch (error) {
        // Log the error explicitly to the console
        console.error("Error in fetching user or cubid_id:", error);
        throw error; // React Query will handle it
      }
    },
    enabled: !!authQuery.data, // Only fetch if authenticated
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
    isAuthenticated: !!authQuery?.data,
    error: userQuery.error || authQuery.error,
    isLoading: authQuery.isLoading || userQuery.isLoading,
    isLoadingUser: userQuery.isLoading,
    signOut: signOutMutation.mutate,
  };
};
