import { createClient } from "@shared/lib/supabase/client"
import { toast } from "react-toastify"

export const insertSuccessNotification = async ({ user_id, notification, additionalData = {} }: { user_id: string, notification: string, additionalData: any }) => {
    const supabase = createClient()
    await supabase.from("notifications").insert({ user_id, notification, ...additionalData })
    toast.success(notification)
}

export const adminInsertNotification = async ({ user_id, notification }: { user_id: string, notification: string }) => {
    const supabase = createClient()
    await supabase.from("app_admin_notifications").insert({ user_id, notification_name: notification })
}