"use client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { WalletHome } from "@tcoin/wallet/components/dashboard";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const router = useRouter();

  const mainClass = "pb-24 p-4 sm:p-8 bg-background text-foreground min-h-screen";

  const content = useMemo(() => {
    if (isLoadingUser || error) return null;
    if (activeTab === "home") {
      return (
        <WalletHome
          qrBgColor="#fff"
          qrFgColor="#000"
          qrWrapperClassName="bg-white p-1"
          tokenLabel="TCOIN"
        />
      );
    }
    const label = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    return (
      <div className="flex items-center justify-center h-full">{`${label} screen coming soon`}</div>
    );
  }, [activeTab, isLoadingUser, error, userData]);

  useEffect(() => {
    if (Boolean(userData?.cubidData?.full_name)) {
      router.replace("/dashboard");
    }
  }, [userData, router]);

  if (error) {
    return <div className={mainClass}>Error loading data: {error.message}</div>;
  }

  if (isLoadingUser) return <div className={mainClass}> ... Loading </div>;

  return (
    <div className={mainClass}>
      {content}
      <DashboardFooter active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
