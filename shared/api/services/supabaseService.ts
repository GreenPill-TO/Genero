import { createClient } from "@shared/lib/supabase/client";
import {
  ensureAuthenticatedUserRecord,
  getEdgePersonas,
} from "@shared/lib/edge/userSettingsClient";
import { getWalletContacts } from "@shared/lib/edge/walletOperationsClient";
import {
  getLegacyCubidData,
  updateLegacyCubidData,
  updateUserPreferences,
  updateUserProfile,
} from "@shared/lib/userSettings/client";
import {
  TProfileCharityPreferences,
  TProfileOnboardingState,
  TProfileTippingPreferences,
  TCubidData,
} from "@shared/types/cubid";
import { TPersona } from "@shared/types/persona";
import { Session } from "@supabase/supabase-js";

export interface StoredUserSharePayload {
  encryptedAesKey: string;
  encryptedData: string;
  encryptionMethod: string;
  id: string;
  iv: string;
  ivForKeyEncryption: string;
  salt: string;
  credentialId: string;
}

export interface SerialisedUserShare {
  userShareEncrypted: StoredUserSharePayload;
  credentialId: string;
}

export interface DeviceInfoPayload {
  userAgent?: string | null;
  platform?: string | null;
  label?: string | null;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const normaliseCredentialId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export const serialiseUserShare = (userShare: {
  encryptedAesKey: ArrayBuffer;
  encryptedData: ArrayBuffer;
  encryptionMethod: string;
  id: string;
  iv: ArrayBuffer;
  ivForKeyEncryption: string;
  salt: string;
  credentialId: ArrayBuffer;
}): SerialisedUserShare => {
  const encodedCredentialId = arrayBufferToBase64(userShare.credentialId);

  return {
    userShareEncrypted: {
      encryptedAesKey: arrayBufferToBase64(userShare.encryptedAesKey),
      encryptedData: arrayBufferToBase64(userShare.encryptedData),
      encryptionMethod: userShare.encryptionMethod,
      id: userShare.id,
      iv: arrayBufferToBase64(userShare.iv),
      ivForKeyEncryption: userShare.ivForKeyEncryption,
      salt: userShare.salt,
      credentialId: encodedCredentialId,
    },
    credentialId: arrayBufferToHex(userShare.credentialId),
  };
};

export const normaliseDeviceInfo = (value: DeviceInfoPayload | null | undefined): Record<string, string> | null => {
  if (!value) {
    return null;
  }

  const normalised: Record<string, string> = {};
  if (typeof value.userAgent === "string" && value.userAgent.trim().length > 0) {
    normalised.userAgent = value.userAgent.trim();
  }
  if (typeof value.platform === "string" && value.platform.trim().length > 0) {
    normalised.platform = value.platform.trim();
  }
  if (typeof value.label === "string" && value.label.trim().length > 0) {
    normalised.label = value.label.trim();
  }

  return Object.keys(normalised).length > 0 ? normalised : null;
};

export const fetchUserByContact = async (authMethod: "phone" | "email" | string, fullContact: string) => {
  try {
    const result = await ensureAuthenticatedUserRecord({
      authMethod,
      fullContact,
    });

    return {
      user: result.user
        ? {
            id: result.user.id,
            cubid_id: result.user.cubid_id,
            has_completed_intro: result.user.has_completed_intro,
            is_admin: result.user.is_admin,
          }
        : null,
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      error,
    };
  }
};

const normaliseNumericId = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

export interface ContactRecord {
  id: number;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  wallet_address: string | null;
  state: string | null;
  last_interaction: string | null;
}

export const fetchContactsForOwner = async (ownerUserId: number | string | null | undefined): Promise<ContactRecord[]> => {
  const ownerId = normaliseNumericId(ownerUserId);
  if (ownerId === null) {
    return [];
  }

  const response = await getWalletContacts({ citySlug: "tcoin" });
  return (response.contacts ?? []).map((contact) => ({
    id: contact.id,
    full_name: contact.fullName ?? null,
    username: contact.username ?? null,
    profile_image_url: contact.profileImageUrl ?? null,
    wallet_address: contact.walletAddress ?? null,
    state: contact.state ?? null,
    last_interaction: contact.lastInteractionAt ?? null,
  }));
};

export const createNewUser = async (authMethod: "phone" | "email", fullContact: string, uuid: string) => {
  try {
    const result = await ensureAuthenticatedUserRecord({
      authMethod,
      fullContact,
      cubidId: uuid,
    });

    return {
      newUser: result.user,
      error: null,
    };
  } catch (error) {
    return {
      newUser: null,
      error,
    };
  }
};

export const fetchCubidDataFromSupabase = async (cubidId: string): Promise<TCubidData> => {
  const response = await getLegacyCubidData();
  return response as unknown as TCubidData;
};

export interface CubidProfileUpdate {
  persona?: string | null;
  tippingPreferences?: Partial<TProfileTippingPreferences> | null;
  charityPreferences?: Partial<TProfileCharityPreferences> | null;
  onboardingState?: Partial<TProfileOnboardingState> | null;
  metadata?: Record<string, unknown> | null;
}

export interface CubidUpdatePayload {
  user?: Record<string, unknown>;
  profile?: CubidProfileUpdate;
}

export const updateCubidDataInSupabase = async (cubidId: string, payload: CubidUpdatePayload) => {
  try {
    if (payload.profile) {
      if (
        "charityPreferences" in payload.profile ||
        "metadata" in payload.profile ||
        "onboardingState" in payload.profile
      ) {
        await updateUserPreferences({
          charity: payload.profile.charityPreferences?.charity ?? undefined,
          selectedCause: payload.profile.charityPreferences?.selectedCause ?? undefined,
        });
      }

      if (
        "persona" in payload.profile ||
        "tippingPreferences" in payload.profile ||
        "metadata" in payload.profile ||
        "onboardingState" in payload.profile
      ) {
        await updateLegacyCubidData({
          user: payload.user ?? {},
          profile: payload.profile,
        });

        return { error: null };
      }
    }

    if (payload.user && Object.keys(payload.user).length > 0) {
      await updateLegacyCubidData({
        user: payload.user,
        profile: {},
      });
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
};

export const getSession = async (): Promise<Session | null> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    console.error("Error fetching session:", err);
    return null;
  }
};

export const waitForAuthenticatedSession = async ({
  timeoutMs = 4000,
  intervalMs = 100,
}: {
  timeoutMs?: number;
  intervalMs?: number;
} = {}): Promise<Session | null> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const session = await getSession();
    if (session?.access_token) {
      return session;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, intervalMs);
    });
  }

  return null;
};

export const signOut = async () => {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (error) {
    throw error;
  }
};

export const sendPasscode = async ({ contact, method }: { contact: string; method: "phone" | "email" }) => {
  try {
    const supabase = createClient();
    const payload = method === "phone" ? { phone: contact } : { email: contact };
    const { error } = await supabase.auth.signInWithOtp(payload);
    if (error) throw error;
  } catch (error) {
    throw error; // Let the calling function handle the error
  }
};

export const verifyPasscode = async ({ contact, method, passcode }: { contact: string; method: "phone" | "email"; passcode: string }) => {
  try {
    const supabase = createClient();
    let verificationPayload: { phone: string; token: string; type: "sms" } | { email: string; token: string; type: "email" };

    if (method === "phone") {
      verificationPayload = { phone: contact, token: passcode, type: "sms" };
    } else {
      verificationPayload = { email: contact, token: passcode, type: "email" };
    }
    const { error } = await supabase.auth.verifyOtp(verificationPayload);
    if (error) {
      throw error;
    }
  } catch (err) {
    throw err; // Let the calling function handle the error
  }
};

export const getPersonas = async (): Promise<TPersona[] | null> => {
  const response = await getEdgePersonas();
  return response.personas ?? null;
};

export { getActiveAppInstance, getActiveAppInstanceId } from "@shared/lib/supabase/appInstance";
