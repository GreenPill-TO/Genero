"use client";
import React from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import dynamic from "next/dynamic";

const WalletScreen = dynamic(
  () => import("./screens/WalletScreen").then((mod) => mod.WalletScreen),
  {
    loading: () => <div className="p-4 text-sm text-muted-foreground sm:p-8">Loading SpareChange wallet…</div>,
  }
);

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
      return (
        <div className={mainClass}>
          <WalletScreen />
        </div>
      );
  }
}
