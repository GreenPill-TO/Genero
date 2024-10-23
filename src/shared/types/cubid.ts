export type TCubidData = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
  profile_image_url: File | null;
  preferred_donation_amount: number;
  selected_cause: string;
  good_tip: number | null;
  default_tip: number | null;
  persona: string | null;
  current_step: number;
  category: string;
  updated_at: string;
};
