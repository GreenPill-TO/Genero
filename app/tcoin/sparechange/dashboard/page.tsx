"use client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { WalletScreen } from "./screens";

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();

  const mainClass = "p-4 sm:p-8";

  if (error) {
    return <div className={mainClass}>Error loading data: {error.message}</div>;
  }

  if (isLoadingUser) return <div className={mainClass}> ... Loading </div>;

  switch (userData?.cubidData?.activeProfile?.persona) {
    // case "ph":
    //   return <div className={mainClass}><PanhandlerScreen /></div>;
    // case "dr":
    //   return <div className={mainClass}><DonorScreen /></div>;
    default:
      return <div className={mainClass}><WalletScreen /></div>;
  }
}
