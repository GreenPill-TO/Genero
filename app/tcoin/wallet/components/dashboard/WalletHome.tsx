import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { fetchContactsForOwner } from "@shared/api/services/supabaseService";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useVoucherPortfolio } from "@shared/hooks/useVoucherPortfolio";
import { createClient } from "@shared/lib/supabase/client";
import { BuyTcoinModal, TopUpModal } from "@tcoin/wallet/components/modals";
import { ContributionsCard } from "./ContributionsCard";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { Hypodata } from "./types";

type RecentInteraction = {
  id: number;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  lastInteractionAt: string | null;
};

export function WalletHome({ tokenLabel = "Tcoin" }: { tokenLabel?: string }) {
  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const router = useRouter();
  const activeProfile = userData?.cubidData?.activeProfile;

  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [selectedCharity, setSelectedCharity] = useState("");
  const [recentInteractions, setRecentInteractions] = useState<RecentInteraction[]>([]);

  const buyCheckoutEnabled =
    (process.env.NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1 ?? "false").trim().toLowerCase() === "true";

  useEffect(() => {
    const defaultCharity = activeProfile?.charityPreferences?.charity;
    if (defaultCharity) {
      setSelectedCharity(defaultCharity);
    }
  }, [activeProfile]);

  const { exchangeRate } = useControlVariables();
  const [charityData] = useState({
    personalContribution: 50,
    allUsersToCharity: 600,
    allUsersToAllCharities: 7000,
  });

  const user_id = userData?.cubidData.id;

  const sanitizeNumeric = useCallback((value: string) => value.replace(/[^\d.]/g, ""), []);
  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;

  const convertTcoinToCad = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || safeExchangeRate === 0) return "";
      return (num * safeExchangeRate).toString();
    },
    [safeExchangeRate]
  );

  const convertCadToTcoin = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || safeExchangeRate === 0) return "";
      return (num / safeExchangeRate).toString();
    },
    [safeExchangeRate]
  );

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setTcoinAmount(rawValue);
    if (rawValue === "") {
      setCadAmount("");
      return;
    }
    const cadRaw = convertTcoinToCad(rawValue);
    setCadAmount(cadRaw);
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = sanitizeNumeric(e.target.value);
    setCadAmount(rawValue);
    if (rawValue === "") {
      setTcoinAmount("");
      return;
    }
    const tcoinRaw = convertCadToTcoin(rawValue);
    setTcoinAmount(tcoinRaw);
  };

  const handleTcoinBlur = () => {
    if (tcoinAmount.trim() === "") {
      setCadAmount("");
      return;
    }
    const numericValue = parseFloat(tcoinAmount);
    if (isNaN(numericValue)) {
      setTcoinAmount("");
      setCadAmount("");
      return;
    }
    const normalizedTcoin = numericValue.toFixed(2);
    const cadNumeric = safeExchangeRate === 0 ? 0 : numericValue * safeExchangeRate;
    setTcoinAmount(normalizedTcoin);
    setCadAmount(cadNumeric.toFixed(2));
  };

  const handleCadBlur = () => {
    if (cadAmount.trim() === "") {
      setTcoinAmount("");
      return;
    }
    const numericValue = parseFloat(cadAmount);
    if (isNaN(numericValue)) {
      setCadAmount("");
      setTcoinAmount("");
      return;
    }
    const normalizedCad = numericValue.toFixed(2);
    const tcoinNumeric = safeExchangeRate === 0 ? 0 : numericValue / safeExchangeRate;
    setCadAmount(normalizedCad);
    setTcoinAmount(tcoinNumeric.toFixed(2));
  };

  function extractAndDecodeBase64(url: string) {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData);
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  }

  const handleScan = useCallback(
    async (data: any) => {
      const rest = extractAndDecodeBase64(data);
      if (!rest?.nano_id) return;
      try {
        const supabase = createClient();
        const { data: userDataFromSupabaseTable, error } = await supabase
          .from("users")
          .select("*")
          .match({ user_identifier: rest.nano_id });
        if (error) throw error;

        const { error: insertError } = await supabase.from("connections").insert({
          owner_user_id: userData?.cubidData?.id,
          connected_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        if (insertError) throw insertError;

        setToSendData(userDataFromSupabaseTable?.[0]);
        if (rest?.qrTcoinAmount) {
          const sanitized = sanitizeNumeric(String(rest.qrTcoinAmount));
          if (sanitized) {
            const numeric = Number.parseFloat(sanitized);
            if (Number.isFinite(numeric)) {
              setTcoinAmount(numeric.toFixed(2));
              const cadNumeric = safeExchangeRate === 0 ? 0 : numeric * safeExchangeRate;
              setCadAmount(cadNumeric.toFixed(2));
            }
          }
        }
        toast.success("Scanned User Successfully");
      } catch (err) {
        console.error("handleScan error", err);
      }
    },
    [safeExchangeRate, sanitizeNumeric, userData]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("pay")) {
      handleScan(url.toString());
    }
  }, [handleScan]);

  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const { senderWallet, sendMoney } = useSendMoney({
    senderId: user_id ?? 0,
    receiverId: toSendData?.id ?? null,
  });

  const { balance: rawBalance } = useTokenBalance(senderWallet);
  const userBalance = parseFloat(rawBalance) || 0;
  const { portfolio } = useVoucherPortfolio({ enabled: Boolean(senderWallet) });
  const [myPoolMerchants, setMyPoolMerchants] = useState<
    Array<{ merchantStoreId: number; displayName?: string; tokenSymbol?: string }>
  >([]);

  useEffect(() => {
    if (!senderWallet) return;

    const loadMerchants = async () => {
      try {
        const response = await fetch("/api/vouchers/merchants?citySlug=tcoin&scope=my_pool", {
          credentials: "include",
        });
        const body = await response.json();
        if (!response.ok) {
          return;
        }
        const rows = Array.isArray(body?.merchants) ? body.merchants : [];
        const normalized = rows
          .filter((row: any) => row && typeof row === "object" && row.available === true)
          .map((row: any) => ({
            merchantStoreId: Number(row.merchantStoreId),
            displayName: typeof row.displayName === "string" ? row.displayName : undefined,
            tokenSymbol: typeof row.tokenSymbol === "string" ? row.tokenSymbol : undefined,
          }))
          .filter((row: any) => Number.isFinite(row.merchantStoreId))
          .slice(0, 6);
        setMyPoolMerchants(normalized);
      } catch {
        setMyPoolMerchants([]);
      }
    };

    void loadMerchants();
  }, [senderWallet]);

  useEffect(() => {
    let isMounted = true;
    if (!user_id) {
      setRecentInteractions([]);
      return () => {
        isMounted = false;
      };
    }

    const supabase = createClient();

    const toTimestamp = (value: string | null | undefined): number => {
      if (!value) return Number.NEGATIVE_INFINITY;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    };

    const upsertRecent = (
      map: Map<number, RecentInteraction>,
      row: Partial<RecentInteraction> & { id: number; lastInteractionAt: string | null }
    ) => {
      const existing = map.get(row.id);
      const nextTimestamp = toTimestamp(row.lastInteractionAt);
      const currentTimestamp = toTimestamp(existing?.lastInteractionAt);

      if (!existing || nextTimestamp >= currentTimestamp) {
        map.set(row.id, {
          id: row.id,
          full_name: row.full_name ?? existing?.full_name ?? null,
          username: row.username ?? existing?.username ?? null,
          profile_image_url: row.profile_image_url ?? existing?.profile_image_url ?? null,
          lastInteractionAt: row.lastInteractionAt,
        });
      }
    };

    const parseMaybeNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const loadRecents = async () => {
      try {
        const recentsByUser = new Map<number, RecentInteraction>();

        try {
          const contacts = await fetchContactsForOwner(user_id);
          contacts.forEach((contact) => {
            upsertRecent(recentsByUser, {
              id: contact.id,
              full_name: contact.full_name,
              username: contact.username,
              profile_image_url: contact.profile_image_url,
              lastInteractionAt: contact.last_interaction,
            });
          });
        } catch {
          // Best effort only.
        }

        const { data: myWalletRows } = await supabase
          .from("wallet_list")
          .select("public_key")
          .eq("user_id", user_id);
        const myWallets = (myWalletRows ?? [])
          .map((row: any) =>
            typeof row.public_key === "string" && row.public_key.trim() !== ""
              ? row.public_key
              : null
          )
          .filter((value: string | null): value is string => value != null);
        const myWalletSet = new Set(myWallets);

        if (myWallets.length > 0) {
          const [toRowsResult, fromRowsResult] = await Promise.all([
            supabase
              .from("act_transaction_entries")
              .select("wallet_account_to, wallet_account_from, created_at")
              .eq("currency", "TCOIN")
              .in("wallet_account_to", myWallets)
              .order("created_at", { ascending: false })
              .limit(80),
            supabase
              .from("act_transaction_entries")
              .select("wallet_account_to, wallet_account_from, created_at")
              .eq("currency", "TCOIN")
              .in("wallet_account_from", myWallets)
              .order("created_at", { ascending: false })
              .limit(80),
          ]);

          const txRows = [...(toRowsResult.data ?? []), ...(fromRowsResult.data ?? [])];
          const walletLastSeen = new Map<string, string>();

          txRows.forEach((row: any) => {
            const toWallet =
              typeof row.wallet_account_to === "string" ? row.wallet_account_to : null;
            const fromWallet =
              typeof row.wallet_account_from === "string" ? row.wallet_account_from : null;
            const createdAt =
              typeof row.created_at === "string" ? row.created_at : null;

            if (!createdAt) return;

            const counterpartWallet =
              toWallet && myWalletSet.has(toWallet)
                ? fromWallet
                : fromWallet && myWalletSet.has(fromWallet)
                  ? toWallet
                  : null;

            if (!counterpartWallet || myWalletSet.has(counterpartWallet)) return;

            const existing = walletLastSeen.get(counterpartWallet);
            if (!existing || toTimestamp(createdAt) > toTimestamp(existing)) {
              walletLastSeen.set(counterpartWallet, createdAt);
            }
          });

          const counterpartWallets = Array.from(walletLastSeen.keys());
          if (counterpartWallets.length > 0) {
            const { data: counterpartWalletRows } = await supabase
              .from("wallet_list")
              .select("user_id, public_key")
              .in("public_key", counterpartWallets);

            const walletToUserId = new Map<string, number>();
            const userIds = new Set<number>();

            (counterpartWalletRows ?? []).forEach((row: any) => {
              const wallet =
                typeof row.public_key === "string" ? row.public_key : null;
              const userId = parseMaybeNumber(row.user_id);
              if (!wallet || userId == null) return;
              walletToUserId.set(wallet, userId);
              userIds.add(userId);
            });

            if (userIds.size > 0) {
              const { data: userRows } = await supabase
                .from("users")
                .select("id, full_name, username, profile_image_url")
                .in("id", Array.from(userIds));

              const usersById = new Map<number, any>();
              (userRows ?? []).forEach((row: any) => {
                const id = parseMaybeNumber(row.id);
                if (id != null) {
                  usersById.set(id, row);
                }
              });

              walletLastSeen.forEach((lastSeen, wallet) => {
                const userId = walletToUserId.get(wallet);
                if (!userId || userId === user_id) return;
                const userRow = usersById.get(userId);
                upsertRecent(recentsByUser, {
                  id: userId,
                  full_name: userRow?.full_name ?? null,
                  username: userRow?.username ?? null,
                  profile_image_url: userRow?.profile_image_url ?? null,
                  lastInteractionAt: lastSeen,
                });
              });
            }
          }
        }

        const { data: requestRows } = await supabase
          .from("invoice_pay_request")
          .select("request_by, request_from, created_at")
          .or(`request_by.eq.${user_id},request_from.eq.${user_id}`)
          .order("created_at", { ascending: false })
          .limit(80);

        const requestLatestByUser = new Map<number, string>();

        (requestRows ?? []).forEach((row: any) => {
          const requestBy = parseMaybeNumber(row.request_by);
          const requestFrom = parseMaybeNumber(row.request_from);
          const createdAt = typeof row.created_at === "string" ? row.created_at : null;
          if (!createdAt) return;

          const counterpart =
            requestBy != null && requestBy !== user_id
              ? requestBy
              : requestFrom != null && requestFrom !== user_id
                ? requestFrom
                : null;

          if (counterpart == null) return;
          const existing = requestLatestByUser.get(counterpart);
          if (!existing || toTimestamp(createdAt) > toTimestamp(existing)) {
            requestLatestByUser.set(counterpart, createdAt);
          }
        });

        if (requestLatestByUser.size > 0) {
          const userIds = Array.from(requestLatestByUser.keys());
          const { data: requestUserRows } = await supabase
            .from("users")
            .select("id, full_name, username, profile_image_url")
            .in("id", userIds);

          (requestUserRows ?? []).forEach((row: any) => {
            const id = parseMaybeNumber(row.id);
            if (id == null || id === user_id) return;
            upsertRecent(recentsByUser, {
              id,
              full_name: row.full_name ?? null,
              username: row.username ?? null,
              profile_image_url: row.profile_image_url ?? null,
              lastInteractionAt: requestLatestByUser.get(id) ?? null,
            });
          });
        }

        const sorted = Array.from(recentsByUser.values())
          .filter((row) => row.id !== user_id)
          .sort((a, b) => toTimestamp(b.lastInteractionAt) - toTimestamp(a.lastInteractionAt))
          .slice(0, 4);

        if (isMounted) {
          setRecentInteractions(sorted);
        }
      } catch (error) {
        console.error("Failed to load recent interactions", error);
        if (isMounted) {
          setRecentInteractions([]);
        }
      }
    };

    void loadRecents();

    return () => {
      isMounted = false;
    };
  }, [user_id]);

  const handleUseMax = () => {
    const cadNumeric = safeExchangeRate === 0 ? 0 : userBalance * safeExchangeRate;
    setTcoinAmount(userBalance.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const openBuyTcoinModal = () => {
    openModal({
      content: <BuyTcoinModal closeModal={closeModal} />,
      title: "Buy TCOIN",
      description: "Checkout with fiat to mint TCOIN automatically from USDC on Celo.",
    });
  };

  const openTopUpModal = () => {
    openModal({
      content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
      title: "Top Up with Interac eTransfer",
      description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} balance.`,
    });
  };

  const openContactProfile = (contactId: number) => {
    router.push(`/dashboard/contacts/${contactId}`);
  };

  return (
    <div className="container mx-auto p-4 space-y-8 pb-24">
      <div className="space-y-8 max-w-[400px] mx-auto md:hidden">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          handleTcoinBlur={handleTcoinBlur}
          handleCadBlur={handleCadBlur}
          sendMoney={sendMoney}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
        />
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet ?? ""}
        />
        <div className="rounded-xl border border-border bg-card/70 p-4 space-y-2">
          <h3 className="text-sm font-semibold">Buy TCOIN</h3>
          <p className="text-xs text-muted-foreground">One checkout flow: fiat to USDC on Celo to TCOIN.</p>
          {buyCheckoutEnabled && (
            <Button className="w-full" onClick={openBuyTcoinModal}>
              Buy TCOIN
            </Button>
          )}
          <Button className="w-full" variant="outline" onClick={openTopUpModal}>
            Top Up with Interac eTransfer
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold">Merchants in My Pool</h3>
          {myPoolMerchants.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No mapped merchants were found in your primary/secondary BIA pools.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {myPoolMerchants.map((merchant) => (
                <li key={`${merchant.merchantStoreId}:${merchant.tokenSymbol ?? "token"}`}>
                  {merchant.displayName ?? `Store ${merchant.merchantStoreId}`}
                  {merchant.tokenSymbol ? ` - ${merchant.tokenSymbol}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <RecentsPanel recents={recentInteractions} onOpenContactProfile={openContactProfile} />
      </div>
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          handleTcoinBlur={handleTcoinBlur}
          handleCadBlur={handleCadBlur}
          sendMoney={sendMoney}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
          userBalance={userBalance}
          onUseMax={handleUseMax}
        />
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet ?? ""}
        />
        <div className="rounded-xl border border-border bg-card/70 p-4 space-y-2">
          <h3 className="text-sm font-semibold">Buy TCOIN</h3>
          <p className="text-xs text-muted-foreground">One checkout flow: fiat to USDC on Celo to TCOIN.</p>
          {buyCheckoutEnabled && (
            <Button className="w-full" onClick={openBuyTcoinModal}>
              Buy TCOIN
            </Button>
          )}
          <Button className="w-full" variant="outline" onClick={openTopUpModal}>
            Top Up with Interac eTransfer
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold">Merchants in My Pool</h3>
          {myPoolMerchants.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No mapped merchants were found in your primary/secondary BIA pools.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {myPoolMerchants.map((merchant) => (
                <li key={`${merchant.merchantStoreId}:${merchant.tokenSymbol ?? "token"}`}>
                  {merchant.displayName ?? `Store ${merchant.merchantStoreId}`}
                  {merchant.tokenSymbol ? ` - ${merchant.tokenSymbol}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <RecentsPanel recents={recentInteractions} onOpenContactProfile={openContactProfile} />
      </div>
    </div>
  );
}

function RecentsPanel({
  recents,
  onOpenContactProfile,
}: {
  recents: RecentInteraction[];
  onOpenContactProfile: (contactId: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <h3 className="text-sm font-semibold">Recents</h3>
      {recents.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No recent contacts yet. Your recent recipients and request interactions will show up here.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {recents.map((contact) => {
            const label = contact.full_name?.trim() || contact.username?.trim() || `User ${contact.id}`;
            const fallback = label.charAt(0).toUpperCase() || "?";
            return (
              <button
                key={contact.id}
                type="button"
                className="flex w-[74px] flex-col items-center gap-1 rounded-md p-1 transition hover:bg-background/70"
                onClick={() => onOpenContactProfile(contact.id)}
                aria-label={`Open profile for ${label}`}
                title={label}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={contact.profile_image_url ?? undefined} alt={label} />
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
