import { toast } from "react-toastify";
import {
  recordWalletTransfer,
  sendWalletAdminNotification,
  sendWalletSuccessNotification,
} from "@shared/lib/edge/walletOperationsClient";
import { createLegacyOfframpRequest } from "@shared/lib/edge/redemptionsClient";
import { createPoolPurchaseRequest } from "@shared/lib/edge/onrampClient";

type SuccessNotificationPayload = {
  user_id: string | number;
  notification: string;
  additionalData?: Record<string, unknown>;
  showToast?: boolean;
};

export const insertSuccessNotification = async ({
  user_id,
  notification,
  additionalData = {},
  showToast = true,
}: SuccessNotificationPayload) => {
  await sendWalletSuccessNotification({
    user_id: Number(user_id),
    notification,
    additionalData,
  });

  if (showToast) {
    toast.success(notification);
  }
};

export const adminInsertNotification = async ({
  user_id,
  notification,
}: {
  user_id: string | number;
  notification: string;
}) => {
  await sendWalletAdminNotification({
    user_id: String(user_id),
    notification,
  });
};

export const transfer = async ({
  recipient_wallet,
  sender_wallet,
  token_price = 3.3,
  transfer_amount,
  transfer_user_id,
}: {
  recipient_wallet: string;
  sender_wallet: string;
  token_price?: number;
  transfer_amount: number;
  transfer_user_id: number;
}) => {
  return recordWalletTransfer({
    recipient_wallet,
    sender_wallet,
    token_price,
    transfer_amount,
    transfer_user_id,
  });
};

type RampRequestWalletParams = {
  p_wallet_account_from?: string | null;
  p_wallet_account_to?: string | null;
  p_wallet_account?: string | null;
};

type RampRequestBase = {
  p_current_token_balance: string;
  p_etransfer_target: string;
  p_exchange_rate?: number;
  p_is_store: number;
  p_tokens_burned: number;
  p_user_id: number;
};

export const off_ramp_req = async ({
  p_current_token_balance,
  p_etransfer_target,
  p_exchange_rate = 3.3,
  p_is_store,
  p_tokens_burned,
  p_user_id,
  p_wallet_account_from,
  p_wallet_account_to,
  p_wallet_account,
}: RampRequestBase & RampRequestWalletParams) => {
  return createLegacyOfframpRequest(
    {
      currentTokenBalance: p_current_token_balance,
      etransferTarget: p_etransfer_target,
      exchangeRate: p_exchange_rate,
      isStore: p_is_store,
      tokensBurned: p_tokens_burned,
      userId: p_user_id,
      walletAccountFrom: p_wallet_account_from ?? p_wallet_account ?? null,
      walletAccountTo: p_wallet_account_to ?? null,
    },
    { citySlug: "tcoin" }
  );
};

export const on_ramp_req = async ({
  p_current_token_balance,
  p_etransfer_target,
  p_exchange_rate = 3.3,
  p_is_store,
  p_tokens_burned,
  p_user_id,
  p_wallet_account_from,
  p_wallet_account_to,
  p_wallet_account,
}: RampRequestBase & RampRequestWalletParams) => {
  return createPoolPurchaseRequest(
    {
      fiatAmount: p_current_token_balance,
      tokenAmount: p_tokens_burned,
      metadata: {
        legacyTarget: p_etransfer_target,
        exchangeRate: p_exchange_rate,
        isStore: p_is_store,
        userId: p_user_id,
        walletAccountFrom: p_wallet_account_from ?? null,
        walletAccountTo: p_wallet_account_to ?? p_wallet_account ?? null,
      },
    },
    { citySlug: "tcoin" }
  );
};
