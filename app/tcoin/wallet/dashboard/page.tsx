"use client";
import React, { useEffect, useMemo } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { WalletScreen } from "./screens/WalletScreen";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();

  const mainClass = "p-4 sm:p-8 bg-background text-foreground min-h-screen";
  const router = useRouter();

  const screenContent = useMemo(() => {
    if (isLoadingUser || error) return null;

    switch (userData?.cubidData?.persona) {
      // case "ph":
      //   return <PanhandlerScreen />;
      // case "dr":
      //   return <DonorScreen />;
      default:
        return <WalletScreen />;
    }
  }, [error, isLoadingUser, userData]);

  useEffect(() => {
    if (!userData?.cubidData?.full_name) {
      router.replace("/welcome");
    }
  }, [userData, router]);

  if (error) {
    return <div className={mainClass}>Error loading data: {error.message}</div>;
  }

  if (isLoadingUser) return <div className={mainClass}> ... Loading </div>;

  return <div className={mainClass}>{screenContent}</div>;
}
