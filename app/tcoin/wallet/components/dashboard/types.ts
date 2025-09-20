import type { ContactRecord } from "@shared/api/services/supabaseService";

export interface Hypodata {
  id: number;
  full_name?: string | null;
  username?: string | null;
  profile_image_url?: string | null;
  wallet_address?: string | null;
  state?: string | null;
}

export const contactRecordToHypodata = (contact: ContactRecord): Hypodata => ({
  id: contact.id,
  full_name: contact.full_name ?? undefined,
  username: contact.username ?? undefined,
  profile_image_url: contact.profile_image_url ?? undefined,
  wallet_address: contact.wallet_address ?? undefined,
  state: contact.state ?? undefined,
});

export interface InvoicePayRequest {
  id: number;
  amount_requested: number | null;
  request_from: number | null;
  request_by?: number | null;
  created_at?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  paid_at?: string | null;
  transaction_id?: number | string | null;
}
