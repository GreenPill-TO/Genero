export type UserSettingsTheme = "system" | "light" | "dark";
export type UserSettingsExperienceMode = "simple" | "advanced";
export type UserSignupState = "none" | "draft" | "completed";
export type UserSignupStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type UserSettingsPendingPaymentIntent = {
  recipientUserId: number;
  recipientName: string | null;
  recipientUsername: string | null;
  recipientProfileImageUrl: string | null;
  recipientWalletAddress: string | null;
  recipientUserIdentifier: string | null;
  amountRequested: number | null;
  sourceToken: string | null;
  sourceMode: "rotating_multi_use" | "single_use" | null;
  createdAt: string | null;
};

export type UserSettingsAppContext = {
  appSlug: string;
  citySlug: string;
  environment: string;
};

export type UserSettingsCharityOption = {
  id: string;
  name: string;
  value: string | null;
};

export type UserSettingsBiaOption = {
  id: string;
  code: string;
  name: string;
};

export type UserSettingsEmail = {
  id: number | null;
  email: string;
  isPrimary: boolean;
  createdAt: string | null;
};

export type UserSettingsUser = {
  id: number;
  cubidId: string;
  authUserId: string | null;
  userIdentifier: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  email: string | null;
  emails: UserSettingsEmail[];
  phone: string | null;
  fullName: string | null;
  firstName: string;
  lastName: string;
  nickname: string | null;
  username: string | null;
  country: string | null;
  address: string | null;
  profileImageUrl: string | null;
  hasCompletedIntro: boolean;
  isNewUser: boolean | null;
};

export type UserSettingsPreferences = {
  theme: UserSettingsTheme;
  experienceMode: UserSettingsExperienceMode;
  hasExplicitExperienceMode: boolean;
  charity: string | null;
  selectedCause: string | null;
  primaryBiaId: string | null;
  secondaryBiaIds: string[];
};

export type UserSettingsOptions = {
  charities: UserSettingsCharityOption[];
  bias: UserSettingsBiaOption[];
};

export type UserSettingsSignup = {
  flow: string;
  state: UserSignupState;
  currentStep: UserSignupStep | null;
  completedSteps: UserSignupStep[];
  walletReady: boolean;
  phoneVerified: boolean;
  pendingPaymentIntent: UserSettingsPendingPaymentIntent | null;
};

export type UserSettingsBootstrap = {
  user: UserSettingsUser;
  app: UserSettingsAppContext & {
    appInstanceId: number;
  };
  preferences: UserSettingsPreferences;
  signup: UserSettingsSignup;
  options: UserSettingsOptions;
};

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  username?: string | null;
  emails?: Array<{
    email: string;
    isPrimary?: boolean;
  }>;
  country?: string | null;
  address?: string | null;
  profileImageUrl?: string | null;
};

export type UpdateUserPreferencesInput = {
  theme?: UserSettingsTheme;
  experienceMode?: UserSettingsExperienceMode;
  charity?: string | null;
  selectedCause?: string | null;
  primaryBiaId?: string | null;
  secondaryBiaIds?: string[];
};

export type SaveUserSignupStepInput = {
  step: UserSignupStep;
  payload?: Record<string, unknown>;
};

export type SavePendingPaymentIntentInput = UserSettingsPendingPaymentIntent;
