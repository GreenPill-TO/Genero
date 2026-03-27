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
import {
  WalletPageIntro,
  WalletSection,
  walletActionButtonClass,
  walletPageClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

const VALID_TAB_KEYS = new Set(["home", "receive", "send", "contacts", "more", "history"]);
const TAB_COPY: Record<string, { title: string; description: string }> = {
  home: {
    title: "Your wallet",
    description:
      "See your balance, move money quickly, and stay oriented without crypto jargon.",
  },
  send: {
    title: "Send money",
    description: "Choose a person, enter an amount, and confirm with the same clarity you expect from a banking app.",
  },
  receive: {
    title: "Request or receive",
    description: "Share your wallet details or send a clear payment request to someone you know.",
  },
  contacts: {
    title: "People you pay",
    description: "Find contacts fast, review recent activity, and start a send or request flow from one place.",
  },
  history: {
    title: "Recent activity",
    description: "Review completed transfers and keep track of money moving in and out of your wallet.",
  },
  more: {
    title: "Settings and tools",
    description: "Manage profile, payout options, theme, routing preferences, and any operator tools you can access.",
  },
};

export default function Dashboard() {
  const { error, isLoadingUser } = useAuth();
  const searchParams = useSearchParams();
  const requestedTab = (searchParams.get("tab") ?? "home").toLowerCase();
  const [activeTab, setActiveTab] = useState("home");
  const [sendRecipient, setSendRecipient] = useState<Hypodata | null>(null);
  const [requestRecipient, setRequestRecipient] = useState<Hypodata | null>(null);
  const [cachedContacts, setCachedContacts] = useState<ContactRecord[] | null>(null);
  const [receiveQrVisible, setReceiveQrVisible] = useState(true);
  const router = useRouter();

  const pageCopy = TAB_COPY[activeTab] ?? TAB_COPY.home;
  const mainClass = cn(walletPageClass, "font-sans lg:pl-32");

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
        <WalletPageIntro
          eyebrow="Authenticated wallet"
          title={pageCopy.title}
          description={pageCopy.description}
          actions={
            [
              activeTab !== "send" ? (
                <button
                  key="send"
                  type="button"
                  className={walletActionButtonClass}
                  onClick={() => handleTabChange("send")}
                >
                  Send money
                </button>
              ) : null,
              activeTab !== "receive" ? (
                <button
                  key="receive"
                  type="button"
                  className={walletActionButtonClass}
                  onClick={() => handleTabChange("receive")}
                >
                  Request money
                </button>
              ) : null,
            ].filter(Boolean)
          }
        />
        <WalletSection className="p-0">
          <div className="p-5 sm:p-6">{content}</div>
        </WalletSection>
        <DashboardFooter active={activeTab} onChange={(next) => handleTabChange(next)} />
      </div>
    </ErrorBoundary>
  );
}
