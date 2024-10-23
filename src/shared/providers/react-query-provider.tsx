"use client"; // Ensure this is only run on the client side

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
// Create the QueryClientProvider component
export const ReactQueryProvider = ({ children }: { children: ReactNode }) => {
  // Create a new QueryClient for each provider instance

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
