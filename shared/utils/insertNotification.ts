import { createClient } from "@shared/lib/supabase/client"
import { toast } from "react-toastify"

export const insertSuccessNotification = async ({ user_id, notification }: { user_id: string, notification: string }) => {
    const supabase = createClient()
    await supabase.from("notifications").insert({ user_id, notification })
    toast.success(notification)
}