import { TPersona } from "@shared/types/persona";
import { useQuery } from "@tanstack/react-query";
import { getPersonas } from "../services/supabaseService";

// Custom hook for authentication, fetching user, and handling Cubid data
export const usePersonas = () => {
  // Fetch session data
  const personaQuery = useQuery<TPersona[] | null>({
    queryKey: ["ref-personas"],
    queryFn: getPersonas,
  });

  return {
    personas: personaQuery.data,
    error: personaQuery.error,
    isLoading: personaQuery.isLoading,
  };
};
