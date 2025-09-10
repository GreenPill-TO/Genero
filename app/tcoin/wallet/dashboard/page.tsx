"use client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useEffect, useMemo } from "react";
import { WalletScreen } from "./screens/WalletScreen";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();

  const mainClass = "p-4 sm:p-8 bg-background text-foreground min-h-screen";
  const router = useRouter()

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
  }, [userData]);
  useEffect(() => {
    if (Boolean(userData?.cubidData?.full_name)) {
      router.replace('/dashboard')
    }
  }, [userData, router])

  if (error) {
    return <div className={mainClass}>Error loading data: {error.message}</div>;
  }

  if (isLoadingUser) return <div className={mainClass}> ... Loading </div>;

  return <div className={mainClass}>{screenContent}</div>;
}
