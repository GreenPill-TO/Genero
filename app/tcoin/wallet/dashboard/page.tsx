"use client";
import { useAuth } from "@shared/api/hooks/useAuth";
import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WalletHome,
  ContactsTab,
  SendTab,
  ReceiveTab,
  MoreTab,
  TransactionHistoryTab,
} from "@tcoin/wallet/components/dashboard";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import type { Hypodata } from "@tcoin/wallet/components/dashboard";

const VALID_TAB_KEYS = new Set(["home", "receive", "send", "contacts", "more", "history"]);

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();
  const searchParams = useSearchParams();
  const requestedTab = (searchParams.get("tab") ?? "home").toLowerCase();
  const [activeTab, setActiveTab] = useState("home");
  const [sendRecipient, setSendRecipient] = useState<Hypodata | null>(null);
  const [requestRecipient, setRequestRecipient] = useState<Hypodata | null>(null);
  const [cachedContacts, setCachedContacts] = useState<ContactRecord[] | null>(null);
  const [receiveQrVisible, setReceiveQrVisible] = useState(true);
  const router = useRouter();

  const mainClass = "font-sans pb-24 p-4 sm:p-8 lg:pb-8 lg:pl-28 bg-background text-foreground min-h-screen";

  const handleTabChange = useCallback(
    (next: string, options?: { showReceiveQr?: boolean }) => {
      setActiveTab(next);
      if (next === "home") {
        router.push("/dashboard");
      } else {
        router.push(`/dashboard?tab=${encodeURIComponent(next)}`);
      }
      if (next === "receive") {
        setReceiveQrVisible(options?.showReceiveQr ?? true);
      }
    },
    [router]
  );

  const content = useMemo(() => {
    if (isLoadingUser || error) return null;
    if (activeTab === "home") {
      return (
        <WalletHome
          tokenLabel="TCOIN"
          onOpenTransactionHistory={() => handleTabChange("history")}
        />
      );
    }
    if (activeTab === "contacts") {
      return (
        <ContactsTab
          initialContacts={cachedContacts ?? undefined}
          onContactsResolved={(records) => setCachedContacts(records)}
          onSend={(contact) => {
            setSendRecipient({ ...contact });
            handleTabChange("send");
          }}
          onRequest={(contact) => {
            setRequestRecipient({ ...contact });
            handleTabChange("receive", { showReceiveQr: false });
          }}
        />
      );
    }
    if (activeTab === "send") {
      return (
        <SendTab
          recipient={sendRecipient}
          onRecipientChange={setSendRecipient}
          contacts={cachedContacts ?? undefined}
        />
      );
    }
    if (activeTab === "receive") {
      return (
        <ReceiveTab
          contact={requestRecipient}
          onContactChange={setRequestRecipient}
          contacts={cachedContacts ?? undefined}
          showQrCode={receiveQrVisible}
        />
      );
    }
    if (activeTab === "more") {
      return <MoreTab tokenLabel="TCOIN" />;
    }
    if (activeTab === "history") {
      return (
        <TransactionHistoryTab
          onBackToDashboard={() => handleTabChange("home")}
        />
      );
    }
    const label = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    return (
      <div className="flex items-center justify-center h-full">{`${label} screen coming soon`}</div>
    );
  }, [
    activeTab,
    isLoadingUser,
    error,
    sendRecipient,
    requestRecipient,
    cachedContacts,
    receiveQrVisible,
    handleTabChange,
  ]);

  useEffect(() => {
    if (!requestRecipient && !receiveQrVisible) {
      setReceiveQrVisible(true);
    }
  }, [requestRecipient, receiveQrVisible]);

  useEffect(() => {
    if (VALID_TAB_KEYS.has(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab, activeTab]);

  if (error) {
    return <div className={mainClass}>Error loading data: {error.message}</div>;
  }

  if (isLoadingUser) return <div className={mainClass}> ... Loading </div>;

  return (
    <ErrorBoundary fallback={<div className={mainClass}>Something went wrong.</div>}>
      <div className={mainClass}>
        {content}
        <DashboardFooter active={activeTab} onChange={(next) => handleTabChange(next)} />
      </div>
    </ErrorBoundary>
  );
}
