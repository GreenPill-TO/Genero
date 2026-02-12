import { createClient } from "@shared/lib/supabase/client";
import { getActiveAppInstance } from "@shared/lib/supabase/appInstance";
import {
  TAppUserProfile,
  TBaseCubidUser,
  TProfileCharityPreferences,
  TProfileOnboardingState,
  TProfileTippingPreferences,
  TCubidData,
} from "@shared/types/cubid";
import { TPersona } from "@shared/types/persona";
import { Session } from "@supabase/supabase-js";

export const fetchUserByContact = async (authMethod: "phone" | "email" | string, fullContact: string) => {
  const supabase = createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, cubid_id, has_completed_intro, is_admin")
    .eq(authMethod === "phone" ? "phone" : "email", fullContact)
    .single();

  return { user, error };
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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normaliseNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normaliseNullableSmallInt = (value: unknown): number | null => {
  const parsed = normaliseNullableNumber(value);
  if (parsed === null) {
    return null;
  }
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
};

const normaliseNullableString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const mapUserRowToBase = (row: any): TBaseCubidUser => {
  const id = normaliseNumericId(row?.id);
  if (id === null) {
    throw new Error("Invalid user identifier returned from Supabase");
  }

  return {
    id,
    cubid_id: typeof row?.cubid_id === "string" ? row.cubid_id : "",
    username: normaliseNullableString(row?.username),
    email: normaliseNullableString(row?.email),
    phone: normaliseNullableString(row?.phone),
    full_name: normaliseNullableString(row?.full_name),
    address: normaliseNullableString(row?.address),
    bio: normaliseNullableString(row?.bio),
    profile_image_url: normaliseNullableString(row?.profile_image_url),
    has_completed_intro: Boolean(row?.has_completed_intro),
    is_new_user: typeof row?.is_new_user === "boolean" ? row.is_new_user : null,
    is_admin: typeof row?.is_admin === "boolean" ? row.is_admin : null,
    auth_user_id: normaliseNullableString(row?.auth_user_id),
    cubid_score: row?.cubid_score ?? null,
    cubid_identity: row?.cubid_identity ?? null,
    cubid_score_details: row?.cubid_score_details ?? null,
    updated_at: normaliseNullableString(row?.updated_at),
    created_at: normaliseNullableString(row?.created_at),
    user_identifier: normaliseNullableString(row?.user_identifier),
    given_names: normaliseNullableString(row?.given_names),
    family_name: normaliseNullableString(row?.family_name),
    nickname: normaliseNullableString(row?.nickname),
    country: normaliseNullableString(row?.country),
  };
};

const mapTippingPreferences = (value: unknown): TProfileTippingPreferences => {
  if (!isRecord(value)) {
    return {
      preferredDonationAmount: null,
      goodTip: null,
      defaultTip: null,
    };
  }

  return {
    preferredDonationAmount: normaliseNullableNumber(value.preferred_donation_amount),
    goodTip: normaliseNullableSmallInt(value.good_tip),
    defaultTip: normaliseNullableSmallInt(value.default_tip),
  };
};

const mapCharityPreferences = (value: unknown): TProfileCharityPreferences => {
  if (!isRecord(value)) {
    return {
      selectedCause: null,
      charity: null,
    };
  }

  return {
    selectedCause: normaliseNullableString(value.selected_cause),
    charity: normaliseNullableString(value.charity),
  };
};

const mapOnboardingState = (value: unknown): TProfileOnboardingState => {
  if (!isRecord(value)) {
    return {
      currentStep: null,
      category: null,
      style: null,
    };
  }

  return {
    currentStep: normaliseNullableSmallInt(value.current_step),
    category: normaliseNullableString(value.category),
    style: normaliseNullableSmallInt(value.style),
  };
};

const mapProfileRow = (row: any): TAppUserProfile => {
  const appInstanceId = normaliseNumericId(row?.app_instance_id);
  if (appInstanceId === null) {
    throw new Error("Invalid app instance identifier returned from Supabase");
  }

  const slug = normaliseNullableString(row?.ref_app_instances?.slug ?? row?.slug);

  return {
    appInstanceId,
    slug,
    persona: normaliseNullableString(row?.persona),
    tippingPreferences: mapTippingPreferences(row?.tipping_preferences),
    charityPreferences: mapCharityPreferences(row?.charity_preferences),
    onboardingState: mapOnboardingState(row?.onboarding_state),
    metadata: isRecord(row?.metadata) ? (row.metadata as Record<string, unknown>) : null,
    createdAt: normaliseNullableString(row?.created_at),
    updatedAt: normaliseNullableString(row?.updated_at),
  };
};

const buildTippingPreferencesPayload = (
  prefs: Partial<TProfileTippingPreferences> | null | undefined
): Record<string, unknown> | null | undefined => {
  if (prefs == null) {
    return null;
  }
  const payload: Record<string, unknown> = {};
  if ("preferredDonationAmount" in prefs) {
    payload.preferred_donation_amount = prefs.preferredDonationAmount ?? null;
  }
  if ("goodTip" in prefs) {
    payload.good_tip = prefs.goodTip ?? null;
  }
  if ("defaultTip" in prefs) {
    payload.default_tip = prefs.defaultTip ?? null;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
};

const buildCharityPreferencesPayload = (
  prefs: Partial<TProfileCharityPreferences> | null | undefined
): Record<string, unknown> | null | undefined => {
  if (prefs == null) {
    return null;
  }
  const payload: Record<string, unknown> = {};
  if ("selectedCause" in prefs) {
    payload.selected_cause = prefs.selectedCause ?? null;
  }
  if ("charity" in prefs) {
    payload.charity = prefs.charity ?? null;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
};

const buildOnboardingStatePayload = (
  state: Partial<TProfileOnboardingState> | null | undefined
): Record<string, unknown> | null | undefined => {
  if (state == null) {
    return null;
  }
  const payload: Record<string, unknown> = {};
  if ("currentStep" in state) {
    payload.current_step = state.currentStep ?? null;
  }
  if ("category" in state) {
    payload.category = state.category ?? null;
  }
  if ("style" in state) {
    payload.style = state.style ?? null;
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
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

  const supabase = createClient();
  const { data: connectionRows, error } = await supabase
    .from("connections")
    .select("connected_user_id, state, modified_at, created_at")
    .eq("owner_user_id", ownerId);

  if (error) {
    throw error;
  }

  const dedupedConnections: Array<{
    id: number;
    state: string | null;
    lastInteraction: string | null;
  }> = [];
  const seen = new Set<number>();

  for (const row of connectionRows ?? []) {
    const id = normaliseNumericId(row.connected_user_id);
    if (id === null || seen.has(id)) {
      continue;
    }
    const rawState = typeof row.state === "string" ? row.state.trim() : null;
    const state = rawState ? rawState.toLowerCase() : null;
    if (state === "rejected") {
      continue;
    }
    seen.add(id);
    const timestamps = [row.modified_at, row.created_at].filter(
      (value): value is string => typeof value === "string" && value.trim() !== ""
    );
    const lastInteraction = timestamps[0] ?? null;
    dedupedConnections.push({ id, state, lastInteraction });
  }

  if (dedupedConnections.length === 0) {
    return [];
  }

  const contactIds = Array.from(seen);

  const { data: contactRows, error: contactError } = await supabase
    .from("users")
    .select("id, full_name, username, profile_image_url")
    .in("id", contactIds);

  if (contactError) {
    throw contactError;
  }

  const { data: walletRows, error: walletError } = await supabase
    .from("wallet_list")
    .select("user_id, public_key")
    .in("user_id", contactIds)
    .order("id", { ascending: false });

  if (walletError) {
    throw walletError;
  }

  const contactsById = new Map<number, any>();
  for (const contact of contactRows ?? []) {
    const normalised = normaliseNumericId(contact.id);
    if (normalised !== null) {
      contactsById.set(normalised, contact);
    }
  }

  const walletsById = new Map<number, string>();
  for (const wallet of walletRows ?? []) {
    const userId = normaliseNumericId(wallet.user_id);
    if (userId !== null && typeof wallet.public_key === "string" && wallet.public_key.trim() !== "") {
      // Only set if not already present (first occurrence wins due to ORDER BY id DESC)
      if (!walletsById.has(userId)) {
        walletsById.set(userId, wallet.public_key);
      }
    }
  }

  const contacts: ContactRecord[] = [];
  for (const connection of dedupedConnections) {
    const user = contactsById.get(connection.id);
    if (!user) continue;
    contacts.push({
      id: connection.id,
      full_name: user.full_name ?? null,
      username: user.username ?? null,
      profile_image_url: user.profile_image_url ?? null,
      wallet_address: walletsById.get(connection.id) ?? null,
      state: connection.state ?? null,
      last_interaction: connection.lastInteraction ?? null,
    });
  }

  return contacts;
};

export const createNewUser = async (authMethod: "phone" | "email", fullContact: string, uuid: string) => {
  const supabase = createClient();
  const { data: newUser, error } = await supabase
    .from("users")
    .insert([
      {
        [authMethod === "phone" ? "phone" : "email"]: fullContact,
        cubid_id: uuid,
        has_completed_intro: false,
      },
    ])
    .single();

  return { newUser, error };
};

export const fetchCubidDataFromSupabase = async (cubidId: string): Promise<TCubidData> => {
  const supabase = createClient();
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select(
      [
        "id",
        "cubid_id",
        "username",
        "email",
        "phone",
        "full_name",
        "address",
        "bio",
        "profile_image_url",
        "has_completed_intro",
        "is_new_user",
        "is_admin",
        "auth_user_id",
        "cubid_score",
        "cubid_identity",
        "cubid_score_details",
        "updated_at",
        "created_at",
        "user_identifier",
        "given_names",
        "family_name",
        "nickname",
        "country",
      ].join(", ")
    )
    .eq("cubid_id", cubidId)
    .single();

  if (userError || !userRow) {
    throw new Error(`Error fetching Supabase data: ${userError?.message ?? "User not found"}`);
  }

  const baseUser = mapUserRowToBase(userRow);

  const { data: profileRows, error: profileError } = await supabase
    .from("app_user_profiles")
    .select(
      "app_instance_id, persona, tipping_preferences, charity_preferences, onboarding_state, metadata, created_at, updated_at, ref_app_instances!inner(slug)"
    )
    .eq("user_id", baseUser.id);

  if (profileError) {
    throw new Error(`Error fetching profile data: ${profileError.message}`);
  }

  const profiles: Record<string, TAppUserProfile> = {};
  for (const row of profileRows ?? []) {
    try {
      const profile = mapProfileRow(row);
      const key = profile.slug ?? String(profile.appInstanceId);
      profiles[key] = profile;
    } catch (error) {
      console.error("Failed to map profile row", error);
    }
  }

  const activeInstance = await getActiveAppInstance();
  let activeProfile: TAppUserProfile | null = null;
  let activeProfileKey: string | null = null;

  if (activeInstance) {
    const preferredKey = activeInstance.slug ?? String(activeInstance.id);
    activeProfile = profiles[preferredKey] ?? null;
    if (!activeProfile) {
      activeProfile = Object.values(profiles).find((profile) => profile.appInstanceId === activeInstance.id) ?? null;
      if (activeProfile) {
        activeProfileKey = activeProfile.slug ?? String(activeProfile.appInstanceId);
      }
    } else {
      activeProfileKey = preferredKey;
    }
  }

  if (!activeProfile && activeInstance?.slug) {
    activeProfileKey = activeInstance.slug;
  }

  return {
    ...baseUser,
    profiles,
    activeProfileKey: activeProfileKey ?? null,
    activeProfile: activeProfile ?? null,
  };
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
  const supabase = createClient();
  const { data: userRow, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("cubid_id", cubidId)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError };
  }

  const userId = normaliseNumericId(userRow?.id);
  if (userId === null) {
    return { error: new Error("Unable to resolve user identifier for Cubid ID") };
  }

  if (payload.user && Object.keys(payload.user).length > 0) {
    const { error } = await supabase.from("users").update(payload.user).eq("id", userId);
    if (error) {
      return { error };
    }
  }

  if (payload.profile) {
    const activeInstance = await getActiveAppInstance();
    if (!activeInstance) {
      return { error: new Error("Active app instance could not be resolved") };
    }

    const nowIso = new Date().toISOString();
    const profileChanges: Record<string, unknown> = {};
    let hasChanges = false;

    if ("persona" in payload.profile) {
      profileChanges.persona = payload.profile.persona ?? null;
      hasChanges = true;
    }

    if ("tippingPreferences" in payload.profile) {
      const tippingPayload = buildTippingPreferencesPayload(payload.profile.tippingPreferences);
      if (tippingPayload !== undefined) {
        profileChanges.tipping_preferences = tippingPayload;
        hasChanges = true;
      }
    }

    if ("charityPreferences" in payload.profile) {
      const charityPayload = buildCharityPreferencesPayload(payload.profile.charityPreferences);
      if (charityPayload !== undefined) {
        profileChanges.charity_preferences = charityPayload;
        hasChanges = true;
      }
    }

    if ("onboardingState" in payload.profile) {
      const onboardingPayload = buildOnboardingStatePayload(payload.profile.onboardingState);
      if (onboardingPayload !== undefined) {
        profileChanges.onboarding_state = onboardingPayload;
        hasChanges = true;
      }
    }

    if ("metadata" in payload.profile) {
      profileChanges.metadata = payload.profile.metadata ?? null;
      hasChanges = true;
    }

    if (hasChanges) {
      profileChanges.updated_at = nowIso;
    }

    const { data: existingProfile, error: fetchProfileError } = await supabase
      .from("app_user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("app_instance_id", activeInstance.id)
      .maybeSingle();

    if (fetchProfileError) {
      return { error: fetchProfileError };
    }

    if (!hasChanges && !existingProfile) {
      // Nothing to do.
    } else if (!hasChanges && existingProfile) {
      // No field-level changes requested for an existing profile.
    } else if (existingProfile) {
      const { error } = await supabase
        .from("app_user_profiles")
        .update(profileChanges)
        .eq("user_id", userId)
        .eq("app_instance_id", activeInstance.id);
      if (error) {
        return { error };
      }
    } else {
      const insertPayload = {
        user_id: userId,
        app_instance_id: activeInstance.id,
        created_at: nowIso,
        ...profileChanges,
      };
      const { error } = await supabase.from("app_user_profiles").insert(insertPayload);
      if (error) {
        return { error };
      }
    }
  }

  return { error: null };
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
  try {
    const supabase = createClient();
    const { data: personas, error: personaError } = await supabase.from("ref_personas").select("*");

    if (personaError || !personas) {
      throw new Error(`Error fetching Supabase data: ${personaError?.message}`);
    }

    return personas;
  } catch (error) {
    throw error;
  }
};

export { getActiveAppInstance, getActiveAppInstanceId } from "@shared/lib/supabase/appInstance";
