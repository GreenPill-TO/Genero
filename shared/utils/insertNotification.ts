import { createClient } from "@shared/lib/supabase/client";
import { toast } from "react-toastify";
import axios from "axios";

export const insertSuccessNotification = async ({ user_id, notification, additionalData = {} }: { user_id: string; notification: string; additionalData: any }) => {
    const supabase = createClient();
    await supabase.from("notifications").insert({ user_id, notification, ...additionalData });
    const { data } = await supabase.from("users").select("*").match({ user_id: user_id });
    if (data?.[0]?.phone) {
        await axios.post("/api/sendsms", {
            message: notification,
            to: data?.[0]?.phone,
        });
    }
    toast.success(notification);
};

export const adminInsertNotification = async ({ user_id, notification }: { user_id: string; notification: string }) => {
    const supabase = createClient();
    await supabase.from("app_admin_notifications").insert({ user_id, notification_name: notification });
};

export const transfer = async ({ recipient_wallet, sender_wallet, token_price = 3.3, transfer_amount, transfer_user_id }: { recipient_wallet: string; sender_wallet: string; token_price?: number; transfer_amount: number; transfer_user_id: number }) => {
    const supabase = createClient();
    await supabase.rpc("simple_transfer", {
        recipient_wallet,
        sender_wallet,
        token_price,
        transfer_amount,
        transfer_user_id,
    });
};

export const off_ramp_req = async ({ p_current_token_balance, p_etransfer_target, p_exchange_rate = 3.3, p_is_store, p_tokens_burned, p_user_id, p_wallet_account }: { p_current_token_balance: string; p_etransfer_target: string; p_exchange_rate?: number; p_is_store: number; p_tokens_burned: number; p_user_id: number; p_wallet_account: string }) => {
    const supabase = createClient();
    await supabase.rpc("create_off_ramp_request", {
        p_current_token_balance,
        p_etransfer_target,
        p_exchange_rate,
        p_is_store,
        p_tokens_burned,
        p_user_id,
        p_wallet_account,
    });
};

export const on_ramp_req = async ({ p_current_token_balance, p_etransfer_target, p_exchange_rate = 3.3, p_is_store, p_tokens_burned, p_user_id, p_wallet_account }: { p_current_token_balance: string; p_etransfer_target: string; p_exchange_rate?: number; p_is_store: number; p_tokens_burned: number; p_user_id: number; p_wallet_account: string }) => {
    const supabase = createClient();
    await supabase.rpc("create_on_ramp_request", {
        p_current_token_balance,
        p_etransfer_target,
        p_exchange_rate,
        p_is_store,
        p_tokens_burned,
        p_user_id,
        p_wallet_account,
    });
};


