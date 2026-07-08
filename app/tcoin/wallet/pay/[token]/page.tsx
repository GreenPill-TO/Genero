"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { useSavePendingPaymentIntentMutation } from "@shared/hooks/useUserSettingsMutations";
import { resolvePaymentRequestLink } from "@shared/lib/edge/paymentRequestLinksClient";
import type { PaymentRequestLinkResolution } from "@shared/lib/edge/paymentRequestLinks";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { Footer } from "@tcoin/wallet/components/footer";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";

function formatTcoinAmount(amount: number | null) {
  if (!Number.isFinite(amount ?? NaN) || (amount ?? 0) <= 0) {
    return "Any amount";
  }

  return `${(amount ?? 0).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TCOIN`;
}

function getRecipientName(link: PaymentRequestLinkResolution | null) {
  return (
    link?.recipient?.fullName?.trim() ||
    link?.recipient?.username?.trim() ||
    "TCOIN recipient"
  );
}

function getRecipientInitials(link: PaymentRequestLinkResolution | null) {
  const name = getRecipientName(link);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0]?.slice(0, 2).toUpperCase() || "TC";
  }
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function getInvalidStateCopy(link: PaymentRequestLinkResolution | null) {
  switch (link?.state) {
    case "expired":
      return {
        title: "This pay link has expired",
        description: "Ask the recipient to open their Receive screen again so we can generate a fresh QR code.",
      };
    case "consumed":
      return {
        title: "This pay link has already been used",
        description: "This one-time request has already been completed. Ask the recipient for a new link if needed.",
      };
    default:
      return {
        title: "We couldn't find that pay link",
        description: "The link may be invalid or no longer available.",
      };
  }
}

export default function WalletPayPage() {
  const params = useParams<{ token: string }>();
  const token =
    typeof params?.token === "string" && params.token.trim()
      ? decodeURIComponent(params.token)
      : "";
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { bootstrap, isLoading: isLoadingSettings } = useUserSettings({
    enabled: isAuthenticated,
  });
  const savePendingPaymentIntent = useSavePendingPaymentIntentMutation();
  const { openModal, closeModal } = useModal();
  const [resolvedLink, setResolvedLink] = useState<PaymentRequestLinkResolution | null>(null);
  const [isLoadingLink, setIsLoadingLink] = useState(true);
  const continuationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!token) {
      setResolvedLink({
        token: "",
        state: "invalid",
        mode: null,
        amountRequested: null,
        expiresAt: null,
        consumedAt: null,
        url: null,
        recipient: null,
      });
      setIsLoadingLink(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingLink(true);
    void resolvePaymentRequestLink(token)
      .then(({ link }) => {
        if (!isMounted) return;
        setResolvedLink(link);
      })
      .catch((error) => {
        console.error("Failed to resolve public pay link:", error);
        if (!isMounted) return;
        setResolvedLink({
          token,
          state: "invalid",
          mode: null,
          amountRequested: null,
          expiresAt: null,
          consumedAt: null,
          url: null,
          recipient: null,
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingLink(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || isLoadingSettings || !bootstrap || !resolvedLink || resolvedLink.state !== "ready") {
      return;
    }

    const continuationKey = `${token}:${bootstrap.user.id}:${bootstrap.signup.state}`;
    if (continuationKeyRef.current === continuationKey) {
      return;
    }
    continuationKeyRef.current = continuationKey;

    if (bootstrap.signup.state === "completed") {
      router.replace(`/dashboard?tab=send&paymentLink=${encodeURIComponent(token)}`);
      return;
    }

    if (!resolvedLink.recipient) {
      return;
    }

    void savePendingPaymentIntent
      .mutateAsync({
        recipientUserId: resolvedLink.recipient.id,
        recipientName: resolvedLink.recipient.fullName,
        recipientUsername: resolvedLink.recipient.username,
        recipientProfileImageUrl: resolvedLink.recipient.profileImageUrl,
        recipientWalletAddress: resolvedLink.recipient.walletAddress,
        recipientUserIdentifier: resolvedLink.recipient.userIdentifier,
        amountRequested: resolvedLink.amountRequested,
        sourceToken: resolvedLink.token,
        sourceMode: resolvedLink.mode,
        createdAt: new Date().toISOString(),
      })
      .then(() => {
        router.replace("/welcome");
      })
      .catch((error) => {
        console.error("Failed to save pending payment intent:", error);
        toast.error("We couldn't prepare this payment yet. Please try again.");
        continuationKeyRef.current = null;
      });
  }, [
    bootstrap,
    isAuthenticated,
    isLoadingSettings,
    resolvedLink,
    router,
    savePendingPaymentIntent,
    token,
  ]);

  const invalidStateCopy = useMemo(() => getInvalidStateCopy(resolvedLink), [resolvedLink]);
  const recipientName = useMemo(() => getRecipientName(resolvedLink), [resolvedLink]);
  const requestedAmount = useMemo(
    () => formatTcoinAmount(resolvedLink?.amountRequested ?? null),
    [resolvedLink]
  );

  const openSignIn = () => {
    openModal({
      content: (
        <SignInModal
          closeModal={closeModal}
          extraObject={{ isSignIn: true }}
          postAuthRedirect={`/pay/${encodeURIComponent(token)}`}
        />
      ),
      elSize: "4xl",
    });
  };

  const isRedirectingAuthenticatedUser =
    isAuthenticated &&
    resolvedLink?.state === "ready" &&
    (isLoadingSettings || Boolean(bootstrap));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground text-base dark:bg-gradient-to-b dark:from-[#000000] dark:via-[#161616] dark:to-[#000000] dark:text-gray-200">
      <LandingHeader />
      <main className="flex-grow bg-background px-6 pt-32 dark:bg-transparent">
        <section className="mx-auto w-full max-w-3xl space-y-6">
          {isLoadingLink ? (
            <div className="space-y-3 text-center">
              <h1 className="font-extrabold text-foreground dark:text-white">Preparing payment link</h1>
              <p className="text-sm text-muted-foreground">We’re checking who this payment is for.</p>
            </div>
          ) : resolvedLink?.state !== "ready" ? (
            <div className="space-y-4 text-center">
              <h1 className="font-extrabold text-foreground dark:text-white">{invalidStateCopy.title}</h1>
              <p className="text-sm text-muted-foreground">{invalidStateCopy.description}</p>
              <div className="pt-2">
                <Link href="/" className="underline">
                  Return home
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-3 text-center">
                <h1 className="font-extrabold text-foreground dark:text-white">Pay with TCOIN</h1>
                <p className="text-sm text-muted-foreground">
                  This public pay link opens the Send flow with the recipient already filled in.
                </p>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-background/95 p-6 shadow-sm dark:bg-black/35">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={resolvedLink.recipient?.profileImageUrl ?? undefined}
                      alt={recipientName}
                    />
                    <AvatarFallback>{getRecipientInitials(resolvedLink)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Recipient
                    </p>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em]">{recipientName}</h2>
                    {resolvedLink.recipient?.username ? (
                      <p className="text-sm text-muted-foreground">@{resolvedLink.recipient.username}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Requested amount
                    </p>
                    <p className="text-lg font-medium">{requestedAmount}</p>
                    <p className="text-sm text-muted-foreground">
                      You can still adjust the amount on the Send screen before confirming.
                    </p>
                  </div>
                </div>
              </div>

              {isRedirectingAuthenticatedUser ? (
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    {bootstrap?.signup.state === "completed"
                      ? "Opening your Send screen…"
                      : "Finishing your wallet setup before we take you to Send…"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sign in to pay now. If you are new, we’ll guide you through wallet setup first and bring you back to this payment afterwards.
                  </p>
                  <div className="flex justify-center">
                    <Button onClick={openSignIn}>Authenticate to pay</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
