export interface TBaseCubidUser {
  id: number;
  cubid_id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  address: string | null;
  bio: string | null;
  profile_image_url: string | null;
  has_completed_intro: boolean;
  is_new_user: boolean | null;
  is_admin: boolean | null;
  auth_user_id: string | null;
  cubid_score: unknown;
  cubid_identity: unknown;
  cubid_score_details: unknown;
  updated_at: string | null;
  created_at: string | null;
  user_identifier: string | null;
  given_names: string | null;
  family_name: string | null;
  nickname: string | null;
  country: string | null;
}

export interface TProfileTippingPreferences {
  preferredDonationAmount: number | null;
  goodTip: number | null;
  defaultTip: number | null;
}

export interface TProfileCharityPreferences {
  selectedCause: string | null;
  charity: string | null;
}

export interface TProfileOnboardingState {
  currentStep: number | null;
  category: string | null;
  style: number | null;
}

export interface TAppUserProfile {
  appInstanceId: number;
  slug: string | null;
  persona: string | null;
  tippingPreferences: TProfileTippingPreferences;
  charityPreferences: TProfileCharityPreferences;
  onboardingState: TProfileOnboardingState;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type TCubidData = TBaseCubidUser & {
  profiles: Record<string, TAppUserProfile>;
  activeProfileKey: string | null;
  activeProfile: TAppUserProfile | null;
};
