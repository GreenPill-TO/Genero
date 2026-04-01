import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { useModal } from "@shared/contexts/ModalContext";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useVoucherPortfolio } from "@shared/hooks/useVoucherPortfolio";
import { getRecentPaymentRequestParticipants } from "@shared/lib/edge/paymentRequestsClient";
import { getVoucherMerchants } from "@shared/lib/edge/voucherPreferencesClient";
import {
  connectWalletContact,
  getWalletRecents,
  lookupWalletUserByIdentifier,
} from "@shared/lib/edge/walletOperationsClient";
import { BuyTcoinModal, TopUpModal } from "@tcoin/wallet/components/modals";
import { ContributionsCard } from "./ContributionsCard";
import { SendCard } from "./SendCard";
import { AccountCard } from "./AccountCard";
import { Hypodata } from "./types";
import {
  walletActionButtonClass,
  walletInteractiveSurfaceClass,
  walletPanelClass,
  walletPanelMutedClass,
} from "./authenticated-ui";

type RecentInteraction = {
  id: number;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  lastInteractionAt: string | null;
};

export function WalletHome({
  tokenLabel = "Tcoin",
  onOpenTransactionHistory,
}: {
  tokenLabel?: string;
  onOpenTransactionHistory?: () => void;
}) {
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
        const lookup = await lookupWalletUserByIdentifier(
          { userIdentifier: rest.nano_id },
          { citySlug: "tcoin" }
        );
        if (!lookup.user) {
          throw new Error("No user matched the scanned QR code.");
        }

        await connectWalletContact(
          { connectedUserId: lookup.user.id, state: "new" },
          { citySlug: "tcoin" }
        );

        setToSendData({
          id: lookup.user.id,
          full_name: lookup.user.fullName,
          username: lookup.user.username,
          profile_image_url: lookup.user.profileImageUrl,
          wallet_address: lookup.user.walletAddress,
          state: lookup.user.state,
        });
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
    [safeExchangeRate, sanitizeNumeric]
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
        const body = await getVoucherMerchants({
          scope: "my_pool",
          appContext: { citySlug: "tcoin" },
        });
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

    const loadRecents = async () => {
      try {
        const recentsByUser = new Map<number, RecentInteraction>();
        const toTimestamp = (value: string | null | undefined): number => {
          if (!value) return Number.NEGATIVE_INFINITY;
          const parsed = Date.parse(value);
          return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
        };
        const upsertRecent = (row: RecentInteraction) => {
          const existing = recentsByUser.get(row.id);
          if (!existing || toTimestamp(row.lastInteractionAt) >= toTimestamp(existing.lastInteractionAt)) {
            recentsByUser.set(row.id, row);
          }
        };

        const [walletRecents, paymentRequestRecents] = await Promise.allSettled([
          getWalletRecents({ citySlug: "tcoin" }),
          getRecentPaymentRequestParticipants({
            appContext: { citySlug: "tcoin" },
          }),
        ]);

        if (walletRecents.status === "fulfilled") {
          walletRecents.value.participants.forEach((participant) => {
            if (participant.id === user_id) return;
            upsertRecent({
              id: participant.id,
              full_name: participant.fullName,
              username: participant.username,
              profile_image_url: participant.profileImageUrl,
              lastInteractionAt: participant.lastInteractionAt ?? null,
            });
          });
        }

        if (paymentRequestRecents.status === "fulfilled") {
          paymentRequestRecents.value.participants.forEach((participant) => {
            if (participant.id === user_id) return;
            upsertRecent({
              id: participant.id,
              full_name: participant.fullName,
              username: participant.username,
              profile_image_url: participant.profileImageUrl,
              lastInteractionAt: participant.lastInteractionAt,
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
      description: "Checkout with fiat to acquire cplTCOIN from USDC on Celo through the TorontoCoin liquidity router.",
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
    <div className="space-y-6 lg:space-y-4">
      <div className="grid gap-6 lg:gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
        <AccountCard
          balance={userBalance}
          totalEquivalent={portfolio ? Number.parseFloat(portfolio.totalEquivalent) : undefined}
          voucherEquivalent={portfolio ? Number.parseFloat(portfolio.voucherEquivalent) : undefined}
          voucherCount={portfolio?.voucherBalances?.length ?? 0}
          senderWallet={senderWallet ?? ""}
          onOpenTransactionHistory={() => onOpenTransactionHistory?.()}
        />
        <section className={`${walletPanelClass} flex flex-col justify-between gap-6`}>
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Everyday actions
            </span>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.04em]">Move money with less friction.</h2>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Keep the next action obvious: send funds, add money, or review the people and merchants you use most.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={walletActionButtonClass} onClick={() => onOpenTransactionHistory?.()}>
              View activity
            </button>
            {buyCheckoutEnabled ? (
              <button type="button" className={walletActionButtonClass} onClick={openBuyTcoinModal}>
                Buy TCOIN
              </button>
            ) : null}
            <button type="button" className={walletActionButtonClass} onClick={openTopUpModal}>
              Top up with Interac
            </button>
            <button type="button" className={walletActionButtonClass} onClick={() => router.push("/dashboard?tab=contacts")}>
              Open contacts
            </button>
          </div>
          <div className={walletPanelMutedClass}>
            <h3 className="text-sm font-semibold">Merchants in My Pool</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              These are the nearby merchants currently matched to your preferred neighbourhood pools.
            </p>
            {myPoolMerchants.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No mapped merchants were found in your primary or secondary BIA pools yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {myPoolMerchants.map((merchant) => (
                  <li
                    key={`${merchant.merchantStoreId}:${merchant.tokenSymbol ?? "token"}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/65 px-4 py-3"
                  >
                    <span>{merchant.displayName ?? `Store ${merchant.merchantStoreId}`}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {merchant.tokenSymbol ?? "TCOIN"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
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
        <RecentsPanel recents={recentInteractions} onOpenContactProfile={openContactProfile} />
      </div>

      <div className="grid gap-6 lg:gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <section className={walletPanelMutedClass}>
          <h3 className="text-sm font-semibold">Need account settings?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Wallet address, explorer access, appearance, charity defaults, and routing preferences now live together in More.
          </p>
          <div className="mt-4">
            <button
              type="button"
              className={walletActionButtonClass}
              onClick={() => router.push("/dashboard?tab=more")}
            >
              Open More
            </button>
          </div>
        </section>
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
    <div className={walletPanelMutedClass}>
      <h3 className="text-sm font-semibold">Recent people</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Jump back into the people you have paid or requested money from most recently.
      </p>
      {recents.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No recent contacts yet. Your recent recipients and request interactions will show up here.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recents.map((contact) => {
            const label = contact.full_name?.trim() || contact.username?.trim() || `User ${contact.id}`;
            const fallback = label.charAt(0).toUpperCase() || "?";
            return (
              <button
                key={contact.id}
                type="button"
                className={`${walletInteractiveSurfaceClass} flex flex-col items-center gap-2 rounded-[20px] px-3 py-4 text-center before:bottom-3 before:top-3`}
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
