export type StoreLifecycleStatus = "draft" | "pending" | "live" | "rejected";
export type MerchantApplicationState = "none" | StoreLifecycleStatus;

export type MerchantApplicationProfile = {
  storeId: number;
  appInstanceId: number;
  lifecycleStatus: StoreLifecycleStatus;
  signupStep: number;
  signupProgressCount: number;
  statusMeta: {
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
  };
  profile: {
    displayName: string | null;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    addressText: string | null;
    lat: number | null;
    lng: number | null;
    slug: string | null;
  };
  bia: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type MerchantApplicationStatusResponse = {
  citySlug: string;
  state: MerchantApplicationState;
  storeId: number | null;
  signupStep: number | null;
  statusMeta: {
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
  } | null;
  application: MerchantApplicationProfile | null;
};

export type MerchantApplicationStepPayload =
  | { consentAccepted: boolean }
  | {
      displayName: string;
      description?: string;
      logoUrl?: string;
      bannerUrl?: string;
    }
  | {
      addressText: string;
      lat: number;
      lng: number;
    }
  | {
      biaId: string;
    }
  | {
      slug: string;
    };

export type CityManagerStoreApplicationRecord = {
  storeId: number;
  appInstanceId: number;
  lifecycleStatus: StoreLifecycleStatus;
  signupStep: number;
  signupProgressCount: number;
  createdAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  applicant: {
    userId: number | null;
    fullName: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    address: string | null;
    profileImageUrl: string | null;
    createdAt: string | null;
  } | null;
  profile: {
    displayName: string | null;
    slug: string | null;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    addressText: string | null;
    lat: number | null;
    lng: number | null;
    walletAddress: string | null;
    status: string | null;
  } | null;
  bia: {
    id: string;
    code: string;
    name: string;
  } | null;
};
