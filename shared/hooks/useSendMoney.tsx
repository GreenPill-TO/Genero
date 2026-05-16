// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { normaliseCredentialId } from "@shared/api/services/supabaseService";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { getWalletCustodyMaterial } from "@shared/lib/edge/userSettingsClient";
import { getWalletContactDetail } from "@shared/lib/edge/walletOperationsClient";
import {
  WebAuthnRequestInProgressError,
  resolveShareSelection,
  resolveTokenRuntimeConfig,
  type UserShareRow,
} from "@shared/lib/wallet/sendMoneyShared";
import type { TransferRecordSnapshot } from "@shared/utils/transferRecord";

type SendMoneyRuntimeModule = typeof import("@shared/lib/wallet/sendMoneyRuntime");

let sendMoneyRuntimePromise: Promise<SendMoneyRuntimeModule> | null = null;

const loadSendMoneyRuntime = () => {
  if (!sendMoneyRuntimePromise) {
    sendMoneyRuntimePromise = import("@shared/lib/wallet/sendMoneyRuntime");
  }

  return sendMoneyRuntimePromise;
};

export const __internal = {
  resolveTokenRuntimeConfig,
  resolveShareSelection,
};

export const useSendMoney = ({
  senderId,
  receiverId = null,
}: {
  senderId: number;
  receiverId?: number | null;
}) => {
  const [senderWallet, setSenderWallet] = useState<string | null>(null);
  const [receiverWallet, setReceiverWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialCandidates, setCredentialCandidates] = useState<string[]>([]);
  const lastTransferRecordRef = useRef<TransferRecordSnapshot | null>(null);
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();

  const getActiveCredentialId = (): string | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const fromStorage = window.localStorage.getItem(
      "tcoin_wallet_activeWalletCredentialId"
    );
    if (fromStorage === null) {
      return null;
    }

    return normaliseCredentialId(fromStorage);
  };

  const fetchWalletAddress = async (
    userId: number | null | undefined,
    setWallet: (wallet: string | null) => void
  ) => {
    if (!userId) {
      setWallet(null);
      return;
    }

    try {
      if (userData?.cubidData?.id === userId) {
        const custody = await getWalletCustodyMaterial();
        setWallet(custody.primaryWallet?.publicKey ?? null);
        return;
      }

      const contact = await getWalletContactDetail(userId, { citySlug: "tcoin" });
      setWallet(
        (contact.contact as { wallet_address?: string | null })?.wallet_address ?? null
      );
    } catch (err: any) {
      console.error("fetchWalletAddress error", err);
      setError(err.message);
      setWallet(null);
    }
  };

  const fetchWalletShares = async (userId: number) => {
    const activeCredentialId = getActiveCredentialId();
    const custody = await getWalletCustodyMaterial();

    if (!custody.appShare) {
      throw new Error("No app_share found for this wallet key");
    }

    const selection = resolveShareSelection({
      userShares: (custody.shares as UserShareRow[] | null | undefined) ?? [],
      activeCredentialId,
      activeAppSlug: custody.appSlug,
    });
    setCredentialCandidates(selection.credentialCandidates);

    if (selection.usedCredentialFallback && activeCredentialId) {
      console.warn(
        `Active credential "${activeCredentialId}" did not match a stored user share. Falling back to the most recently used credential.`
      );
    }

    if (!selection.selectedShare?.user_share_encrypted) {
      throw new Error("No user_share_encrypted found for this wallet key");
    }

    return {
      appShare: custody.appShare,
      userShareEncrypted: selection.selectedShare.user_share_encrypted,
    };
  };

  useEffect(() => {
    void fetchWalletAddress(senderId, setSenderWallet);
    void fetchWalletAddress(receiverId, setReceiverWallet);
  }, [receiverId, senderId, userData?.cubidData?.id]);

  useEffect(() => {
    const loadCredentialOptions = async () => {
      if (!userData?.cubidData?.id) {
        setCredentialCandidates([]);
        return;
      }

      try {
        const custody = await getWalletCustodyMaterial();
        if (!custody.shares?.length) {
          setCredentialCandidates([]);
          return;
        }

        const options = custody.shares
          .map((row) => normaliseCredentialId(row.credential_id))
          .filter((value): value is string => Boolean(value));
        setCredentialCandidates(options);
      } catch (err) {
        console.warn("Could not preload credential candidates:", err);
      }
    };

    void loadCredentialOptions();
  }, [userData?.cubidData?.id]);

  const getLastTransferRecord = () => {
    const snapshot = lastTransferRecordRef.current;
    lastTransferRecordRef.current = null;
    return snapshot;
  };

  const burnMoney = async (amount: string | number) => {
    if (!senderWallet) {
      const message = "Wallet addresses not found";
      setError(message);
      throw new Error(message);
    }

    const cubidUserId = userData?.cubidData?.id;
    if (!cubidUserId) {
      const message = "No valid Cubid user ID found";
      setError(message);
      throw new Error(message);
    }

    setLoading(true);
    setError(null);

    try {
      const sharePayload = await fetchWalletShares(cubidUserId);
      const runtime = await loadSendMoneyRuntime();
      return await runtime.burnToken({
        amount,
        sharePayload,
      });
    } catch (err: any) {
      console.error("Transaction error:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We could not burn this amount. Please try again.";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const sendMoney = async (amount: string | number) => {
    lastTransferRecordRef.current = null;

    if (!senderId) {
      const message = "Your account details are missing. Please sign in again.";
      setError(message);
      throw new Error(message);
    }

    if (!senderWallet) {
      const message =
        "Your wallet address could not be found. Please try again later.";
      setError(message);
      throw new Error(message);
    }

    if (!receiverWallet) {
      const message =
        "Recipient wallet address not found. Ask them to finish setting up their wallet.";
      setError(message);
      throw new Error(message);
    }

    const cubidUserId = userData?.cubidData?.id;
    if (!cubidUserId) {
      const message = "No valid Cubid user ID found";
      setError(message);
      throw new Error(message);
    }

    setLoading(true);
    setError(null);

    try {
      const sharePayload = await fetchWalletShares(cubidUserId);
      const runtime = await loadSendMoneyRuntime();
      const result = await runtime.sendTokenTransfer({
        amount,
        senderWallet,
        receiverWallet,
        senderId,
        exchangeRate,
        sharePayload,
      });
      lastTransferRecordRef.current = result.transferRecord;
      return result.transactionHash;
    } catch (err: any) {
      lastTransferRecordRef.current = null;
      if (!(err instanceof WebAuthnRequestInProgressError)) {
        console.error("Transaction error:", err);
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We could not send your payment. Please try again.";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const executeVoucherPayment = async ({
    amount,
    poolAddress,
    voucherTokenAddress,
    recipientWalletAddress,
    minAmountOut,
    tokenDecimals = 18,
  }: {
    amount: string;
    poolAddress: string;
    voucherTokenAddress: string;
    recipientWalletAddress: string;
    minAmountOut?: string;
    tokenDecimals?: number;
  }) => {
    if (!senderWallet) {
      const message =
        "Your wallet address could not be found. Please try again later.";
      setError(message);
      throw new Error(message);
    }

    const cubidUserId = userData?.cubidData?.id;
    if (!cubidUserId) {
      const message = "No valid Cubid user ID found";
      setError(message);
      throw new Error(message);
    }

    setLoading(true);
    setError(null);

    try {
      const sharePayload = await fetchWalletShares(cubidUserId);
      const runtime = await loadSendMoneyRuntime();
      return await runtime.executeVoucherTransfer({
        amount,
        poolAddress,
        voucherTokenAddress,
        recipientWalletAddress,
        minAmountOut,
        tokenDecimals,
        sharePayload,
      });
    } catch (err: any) {
      if (!(err instanceof WebAuthnRequestInProgressError)) {
        console.error("Voucher payment error:", err);
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : "We could not complete this voucher payment. Please try again.";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return {
    senderWallet,
    receiverWallet,
    sendMoney,
    executeVoucherPayment,
    loading,
    error,
    burnMoney,
    getLastTransferRecord,
    credentialCandidates,
  };
};
