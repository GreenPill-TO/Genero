"use client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import {
  WalletHome,
  ContactsTab,
  SendTab,
  ReceiveTab,
} from "@tcoin/wallet/components/dashboard";
import { DashboardFooter } from "@tcoin/wallet/components/DashboardFooter";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { useRouter } from "next/navigation";
import type { ContactRecord } from "@shared/api/services/supabaseService";
import type { Hypodata } from "@tcoin/wallet/components/dashboard";

export default function Dashboard() {
  const { userData, error, isLoadingUser } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [sendRecipient, setSendRecipient] = useState<Hypodata | null>(null);
  const [requestRecipient, setRequestRecipient] = useState<Hypodata | null>(null);
  const [cachedContacts, setCachedContacts] = useState<ContactRecord[] | null>(null);
  const router = useRouter();

  const mainClass = "font-sans pb-24 p-4 sm:p-8 bg-background text-foreground min-h-screen";

  const content = useMemo(() => {
    if (isLoadingUser || error) return null;
    if (activeTab === "home") {
      return <WalletHome tokenLabel="TCOIN" />;
    }
    if (activeTab === "contacts") {
      return (
        <ContactsTab
          initialContacts={cachedContacts ?? undefined}
          onContactsResolved={(records) => setCachedContacts(records)}
          onSend={(contact) => {
            setSendRecipient({ ...contact });
            setActiveTab("send");
          }}
          onRequest={(contact) => {
            setRequestRecipient({ ...contact });
            setActiveTab("receive");
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
        />
      );
    }
    const label = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    return (
      <div className="flex items-center justify-center h-full">{`${label} screen coming soon`}</div>
    );
  }, [activeTab, isLoadingUser, error, sendRecipient, requestRecipient, cachedContacts]);

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
    <ErrorBoundary fallback={<div className={mainClass}>Something went wrong.</div>}>
      <div className={mainClass}>
        {content}
        <DashboardFooter active={activeTab} onChange={setActiveTab} />
      </div>
    </ErrorBoundary>
  );
}
