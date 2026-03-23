type JsonRecord = Record<string, unknown>;

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

function isRecord(value: unknown): value is JsonRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableInteger(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed == null) {
    return null;
  }
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function splitFullName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  const firstName = parts.shift() ?? "";
  return {
    firstName,
    lastName: parts.join(" "),
  };
}

function normaliseTheme(value: unknown): "system" | "light" | "dark" {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function ensureObject(value: unknown): JsonRecord {
  return isRecord(value) ? { ...value } : {};
}

function dedupeStepList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 6)
    )
  ).sort((a, b) => a - b);
}

function allowsWalletSkip(environment: string | null | undefined): boolean {
  const normalized = (environment ?? "").trim().toLowerCase();
  return normalized === "development" || normalized === "local";
}

function isMissingTableError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function resolveSignupMetadata(value: unknown) {
  const metadata = ensureObject(value);

  return {
    flow: typeof metadata.flow === "string" ? metadata.flow : "general-user-v1",
    status: metadata.status === "completed" ? "completed" : metadata.status === "draft" ? "draft" : null,
    currentStep: (() => {
      const parsed = Number(metadata.currentStep);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : null;
    })(),
    completedSteps: dedupeStepList(metadata.completedSteps),
    startedAt: toNullableString(metadata.startedAt),
    lastSavedAt: toNullableString(metadata.lastSavedAt),
    completedAt: toNullableString(metadata.completedAt),
    phoneVerified: metadata.phoneVerified === true,
  };
}

async function ensureAppProfile(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const { data: existing, error: existingError } = await options.supabase
    .from("app_user_profiles")
    .select("user_id,app_instance_id,charity_preferences,onboarding_state,metadata")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load app profile: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await options.supabase
    .from("app_user_profiles")
    .insert({
      user_id: options.userId,
      app_instance_id: options.appInstanceId,
      created_at: nowIso,
      updated_at: nowIso,
      metadata: {},
    })
    .select("user_id,app_instance_id,charity_preferences,onboarding_state,metadata")
    .single();

  if (insertError) {
    throw new Error(`Failed to create app profile: ${insertError.message}`);
  }

  return inserted;
}

async function resolveWalletReady(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const [{ data: walletRow, error: walletError }, shareResult] = await Promise.all([
    options.supabase
      .from("wallet_list")
      .select("id")
      .eq("user_id", options.userId)
      .eq("namespace", "EVM")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("user_encrypted_share")
      .select("id")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (walletError) {
    throw new Error(`Failed to load wallet readiness: ${walletError.message}`);
  }

  let shareRow = shareResult.data;
  let shareError = shareResult.error;

  if (shareError?.message?.includes("app_instance_id")) {
    const fallbackShareResult = await options.supabase
      .from("user_encrypted_share")
      .select("id")
      .eq("user_id", options.userId)
      .limit(1)
      .maybeSingle();

    shareRow = fallbackShareResult.data;
    shareError = fallbackShareResult.error;
  }

  if (shareError) {
    throw new Error(`Failed to load encrypted-share readiness: ${shareError.message}`);
  }

  return Boolean(walletRow?.id && shareRow?.id);
}

async function resolveBiaSelection(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const [{ data: primary, error: primaryError }, { data: secondaryRows, error: secondaryError }] = await Promise.all([
    options.supabase
      .from("user_bia_affiliations")
      .select("bia_id")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .is("effective_to", null)
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("user_bia_secondary_affiliations")
      .select("bia_id")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .is("effective_to", null),
  ]);

  if (primaryError) {
    throw new Error(`Failed to load primary BIA: ${primaryError.message}`);
  }

  if (secondaryError) {
    throw new Error(`Failed to load secondary BIAs: ${secondaryError.message}`);
  }

  return {
    primaryBiaId: toNullableString(primary?.bia_id),
    secondaryBiaIds: Array.isArray(secondaryRows)
      ? secondaryRows.map((row: any) => String(row.bia_id)).filter(Boolean)
      : [],
  };
}

function buildUpdatedMetadata(options: {
  currentMetadata: unknown;
  theme?: "system" | "light" | "dark";
  signup?: JsonRecord | null;
}) {
  const metadata = ensureObject(options.currentMetadata);

  if (options.theme) {
    const appearance = ensureObject(metadata.appearance);
    appearance.theme = options.theme;
    metadata.appearance = appearance;
  }

  if (options.signup === null) {
    delete metadata.signup;
  } else if (options.signup) {
    metadata.signup = options.signup;
  }

  return metadata;
}

function buildUpdatedOnboardingState(currentValue: unknown, currentStep: number | null) {
  const onboardingState = ensureObject(currentValue);
  onboardingState.current_step = currentStep;
  return onboardingState;
}

async function writeBiaSelection(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
  citySlug: string;
  primaryBiaId: string;
  secondaryBiaIds: string[];
}) {
  const { data: primaryRow, error: primaryError } = await options.supabase
    .from("bia_registry")
    .select("id")
    .eq("id", options.primaryBiaId)
    .eq("city_slug", options.citySlug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (primaryError) {
    throw new Error(`Failed to validate primary BIA: ${primaryError.message}`);
  }

  if (!primaryRow) {
    throw new Error("Selected primary BIA is not active for this city.");
  }

  const dedupedSecondaryIds = Array.from(
    new Set(options.secondaryBiaIds.map((value) => value.trim()).filter((value) => value && value !== options.primaryBiaId))
  );

  if (dedupedSecondaryIds.length > 0) {
    const { data: validSecondaryRows, error: validSecondaryError } = await options.supabase
      .from("bia_registry")
      .select("id")
      .eq("city_slug", options.citySlug)
      .eq("status", "active")
      .in("id", dedupedSecondaryIds);

    if (validSecondaryError) {
      throw new Error(`Failed to validate secondary BIAs: ${validSecondaryError.message}`);
    }

    if ((validSecondaryRows ?? []).length !== dedupedSecondaryIds.length) {
      throw new Error("One or more secondary BIAs are invalid or inactive for this city.");
    }
  }

  const nowIso = new Date().toISOString();

  const { error: closePrimaryError } = await options.supabase
    .from("user_bia_affiliations")
    .update({ effective_to: nowIso, updated_at: nowIso })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .is("effective_to", null);

  if (closePrimaryError) {
    throw new Error(`Failed to close previous primary BIA: ${closePrimaryError.message}`);
  }

  const { error: closeSecondaryError } = await options.supabase
    .from("user_bia_secondary_affiliations")
    .update({ effective_to: nowIso, updated_at: nowIso })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .is("effective_to", null);

  if (closeSecondaryError) {
    throw new Error(`Failed to close previous secondary BIAs: ${closeSecondaryError.message}`);
  }

  const { error: insertPrimaryError } = await options.supabase.from("user_bia_affiliations").insert({
    user_id: options.userId,
    app_instance_id: options.appInstanceId,
    bia_id: options.primaryBiaId,
    source: "user_selected",
    effective_from: nowIso,
    effective_to: null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (insertPrimaryError) {
    throw new Error(`Failed to save primary BIA: ${insertPrimaryError.message}`);
  }

  if (dedupedSecondaryIds.length > 0) {
    const { error: insertSecondaryError } = await options.supabase.from("user_bia_secondary_affiliations").insert(
      dedupedSecondaryIds.map((biaId) => ({
        user_id: options.userId,
        app_instance_id: options.appInstanceId,
        bia_id: biaId,
        source: "user_selected",
        effective_from: nowIso,
        effective_to: null,
        created_at: nowIso,
        updated_at: nowIso,
      }))
    );

    if (insertSecondaryError) {
      throw new Error(`Failed to save secondary BIAs: ${insertSecondaryError.message}`);
    }
  }
}

async function clearBiaSelection(options: {
  supabase: any;
  userId: number;
  appInstanceId: number;
}) {
  const nowIso = new Date().toISOString();

  const [{ error: clearPrimaryError }, { error: clearSecondaryError }] = await Promise.all([
    options.supabase
      .from("user_bia_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .is("effective_to", null),
    options.supabase
      .from("user_bia_secondary_affiliations")
      .update({ effective_to: nowIso, updated_at: nowIso })
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appInstanceId)
      .is("effective_to", null),
  ]);

  if (clearPrimaryError) {
    throw new Error(`Failed to clear primary BIA selection: ${clearPrimaryError.message}`);
  }

  if (clearSecondaryError) {
    throw new Error(`Failed to clear secondary BIA selection: ${clearSecondaryError.message}`);
  }
}

async function validateUsername(options: {
  supabase: any;
  userId: number;
  username: string | null;
}) {
  if (!options.username) {
    return null;
  }

  const normalised = options.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalised)) {
    throw new Error("Username must be 3-32 characters and use lowercase letters, numbers, dots, underscores or hyphens.");
  }

  const { data: existingUser, error: existingError } = await options.supabase
    .from("users")
    .select("id")
    .eq("username", normalised)
    .neq("id", options.userId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to validate username: ${existingError.message}`);
  }

  if (existingUser?.id) {
    throw new Error("That username is already in use.");
  }

  return normalised;
}

export async function getUserSettingsBootstrap(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const [{ data: userRow, error: userError }, appProfile, walletReady, biaSelection, charitiesResult, biasResult] =
    await Promise.all([
      options.supabase
        .from("users")
        .select(
          "id,cubid_id,email,phone,full_name,nickname,username,country,profile_image_url,has_completed_intro,is_new_user"
        )
        .eq("id", options.userId)
        .limit(1)
        .maybeSingle(),
      ensureAppProfile({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
      }),
      resolveWalletReady({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
      }),
      resolveBiaSelection({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
      }),
      options.supabase.from("charities").select("id,name,value").order("name", { ascending: true }),
      options.supabase
        .from("bia_registry")
        .select("id,code,name")
        .eq("city_slug", options.appContext.citySlug)
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

  if (userError) {
    throw new Error(`Failed to load user settings: ${userError.message}`);
  }

  if (!userRow) {
    throw new Error("User not found.");
  }

  const charitiesError = charitiesResult.error;
  const biasError = biasResult.error;

  if (charitiesError && !isMissingTableError(charitiesError.message)) {
    throw new Error(`Failed to load charities: ${charitiesResult.error.message}`);
  }

  if (biasError && !isMissingTableError(biasError.message)) {
    throw new Error(`Failed to load BIAs: ${biasResult.error.message}`);
  }

  const metadata = ensureObject(appProfile.metadata);
  const appearance = ensureObject(metadata.appearance);
  const signup = resolveSignupMetadata(metadata.signup);
  const charityPreferences = ensureObject(appProfile.charity_preferences);
  const { firstName, lastName } = splitFullName(toNullableString(userRow.full_name));

  const phoneVerified = Boolean(userRow.phone) || signup.phoneVerified;
  const signupState = Boolean(userRow.has_completed_intro)
    ? "completed"
    : signup.status === "draft"
      ? "draft"
      : "none";

  return {
    user: {
      id: Number(userRow.id),
      cubidId: typeof userRow.cubid_id === "string" ? userRow.cubid_id : "",
      email: toNullableString(userRow.email),
      phone: toNullableString(userRow.phone),
      fullName: toNullableString(userRow.full_name),
      firstName,
      lastName,
      nickname: toNullableString(userRow.nickname),
      username: toNullableString(userRow.username),
      country: toNullableString(userRow.country),
      profileImageUrl: toNullableString(userRow.profile_image_url),
      hasCompletedIntro: Boolean(userRow.has_completed_intro),
      isNewUser: typeof userRow.is_new_user === "boolean" ? userRow.is_new_user : null,
    },
    app: options.appContext,
    preferences: {
      theme: normaliseTheme(appearance.theme),
      charity: toNullableString(charityPreferences.charity),
      selectedCause: toNullableString(charityPreferences.selected_cause),
      primaryBiaId: biaSelection.primaryBiaId,
      secondaryBiaIds: biaSelection.secondaryBiaIds,
    },
    signup: {
      state: signupState,
      currentStep: signupState === "none" ? null : ((signup.currentStep ?? (signupState === "completed" ? 6 : 1)) as 1 | 2 | 3 | 4 | 5 | 6),
      completedSteps:
        signupState === "completed"
          ? [1, 2, 3, 4, 5, 6]
          : (signup.completedSteps as Array<1 | 2 | 3 | 4 | 5 | 6>),
      walletReady,
      phoneVerified,
    },
    options: {
      charities: ((charitiesError && isMissingTableError(charitiesError.message) ? [] : charitiesResult.data) ?? []).map((row: any) => ({
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : String(row.id),
        value: toNullableString(row.value),
      })),
      bias: ((biasError && isMissingTableError(biasError.message) ? [] : biasResult.data) ?? []).map((row: any) => ({
        id: String(row.id),
        code: typeof row.code === "string" ? row.code : "BIA",
        name: typeof row.name === "string" ? row.name : String(row.id),
      })),
    },
  };
}

export async function updateUserProfile(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  payload: JsonRecord;
}) {
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const firstName = toNullableString(options.payload.firstName);
  const lastName = toNullableString(options.payload.lastName);
  const nickname = "nickname" in options.payload ? toNullableString(options.payload.nickname) : undefined;
  const country = "country" in options.payload ? toNullableString(options.payload.country) : undefined;
  const profileImageUrl =
    "profileImageUrl" in options.payload ? toNullableString(options.payload.profileImageUrl) : undefined;
  const usernameInput = "username" in options.payload ? toNullableString(options.payload.username) : undefined;
  const username = await validateUsername({
    supabase: options.supabase,
    userId: options.userId,
    username: usernameInput ?? null,
  });

  const updates: JsonRecord = {};
  if ("firstName" in options.payload || "lastName" in options.payload) {
    if (!firstName || !lastName) {
      throw new Error("First name and last name are required.");
    }
    updates.full_name = `${firstName} ${lastName}`.trim();
  }
  if ("nickname" in options.payload) {
    updates.nickname = nickname;
  }
  if ("country" in options.payload) {
    updates.country = country;
  }
  if ("profileImageUrl" in options.payload) {
    updates.profile_image_url = profileImageUrl;
  }
  if ("username" in options.payload) {
    updates.username = username;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await options.supabase.from("users").update(updates).eq("id", options.userId);
    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function updateUserPreferences(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  payload: JsonRecord;
}) {
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  const nowIso = new Date().toISOString();
  const nextMetadata = buildUpdatedMetadata({
    currentMetadata: appProfile.metadata,
    theme: "theme" in options.payload ? normaliseTheme(options.payload.theme) : undefined,
  });

  let nextCharityPreferences = appProfile.charity_preferences;
  if ("charity" in options.payload || "selectedCause" in options.payload) {
    const charityPrefs = ensureObject(appProfile.charity_preferences);
    if ("charity" in options.payload) {
      charityPrefs.charity = toNullableString(options.payload.charity);
    }
    if ("selectedCause" in options.payload) {
      charityPrefs.selected_cause = toNullableString(options.payload.selectedCause);
    }
    nextCharityPreferences = charityPrefs;
  }

  const { error: profileUpdateError } = await options.supabase
    .from("app_user_profiles")
    .update({
      metadata: nextMetadata,
      charity_preferences: nextCharityPreferences,
      updated_at: nowIso,
    })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (profileUpdateError) {
    throw new Error(`Failed to update preferences: ${profileUpdateError.message}`);
  }

  if ("primaryBiaId" in options.payload) {
    const primaryBiaId = toNullableString(options.payload.primaryBiaId);
    const secondaryBiaIds = Array.isArray(options.payload.secondaryBiaIds)
      ? options.payload.secondaryBiaIds.map((value) => String(value))
      : [];

    if (!primaryBiaId) {
      await clearBiaSelection({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
      });
    } else {
      await writeBiaSelection({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
        citySlug: options.appContext.citySlug,
        primaryBiaId,
        secondaryBiaIds,
      });
    }
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function startSignup(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const metadata = ensureObject(appProfile.metadata);
  const signup = resolveSignupMetadata(metadata.signup);

  if (signup.status === "completed") {
    return getUserSettingsBootstrap({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
    });
  }

  if (signup.status === "draft") {
    return getUserSettingsBootstrap({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
    });
  }

  const nowIso = new Date().toISOString();
  const nextSignup = {
    flow: "general-user-v1",
    status: "draft",
    currentStep: 1,
    completedSteps: [],
    startedAt: nowIso,
    lastSavedAt: nowIso,
    completedAt: null,
    phoneVerified: false,
  };

  const { error: updateError } = await options.supabase
    .from("app_user_profiles")
    .update({
      metadata: buildUpdatedMetadata({
        currentMetadata: appProfile.metadata,
        signup: nextSignup,
      }),
      onboarding_state: buildUpdatedOnboardingState(appProfile.onboarding_state, 1),
      updated_at: nowIso,
    })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (updateError) {
    throw new Error(`Failed to start signup: ${updateError.message}`);
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function saveSignupStep(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  payload: JsonRecord;
}) {
  const step = Number(options.payload.step);
  if (!Number.isInteger(step) || step < 1 || step > 5) {
    throw new Error("Signup step must be between 1 and 5.");
  }

  const rawPayload = isRecord(options.payload.payload) ? options.payload.payload : {};
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const existingSignup = resolveSignupMetadata(ensureObject(appProfile.metadata).signup);
  const nowIso = new Date().toISOString();

  const nextSignup = {
    flow: "general-user-v1",
    status: "draft",
    currentStep: Math.min(6, step + 1),
    completedSteps: Array.from(new Set([...(existingSignup.completedSteps ?? []), step])).sort((a, b) => a - b),
    startedAt: existingSignup.startedAt ?? nowIso,
    lastSavedAt: nowIso,
    completedAt: null,
    phoneVerified: existingSignup.phoneVerified,
  };

  if (step === 1) {
    if (rawPayload.introAccepted !== true) {
      throw new Error("Welcome acknowledgement is required.");
    }
  }

  if (step === 2) {
    const phoneVerified = rawPayload.phoneVerified === true;
    if (!phoneVerified) {
      throw new Error("Phone verification is required.");
    }

    await updateUserProfile({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
      payload: {
        firstName: rawPayload.firstName,
        lastName: rawPayload.lastName,
        nickname: rawPayload.nickname,
        username: rawPayload.username,
        country: rawPayload.country,
      },
    });

    nextSignup.phoneVerified = true;
  }

  if (step === 3) {
    await updateUserProfile({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
      payload: {
        profileImageUrl: "profileImageUrl" in rawPayload ? rawPayload.profileImageUrl : null,
      },
    });
  }

  if (step === 4) {
    const primaryBiaId = toNullableString(rawPayload.primaryBiaId);
    const charity = toNullableString(rawPayload.charity);
    if (!charity) {
      throw new Error("Default charity is required.");
    }
    if (!primaryBiaId) {
      throw new Error("Primary BIA is required.");
    }

    await updateUserPreferences({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
      payload: {
        charity,
        selectedCause: toNullableString(rawPayload.selectedCause) ?? charity,
        primaryBiaId,
        secondaryBiaIds: Array.isArray(rawPayload.secondaryBiaIds) ? rawPayload.secondaryBiaIds : [],
      },
    });
  }

  if (step === 5) {
    const skipWalletSetup = rawPayload.skipWalletSetup === true;
    const walletReady = await resolveWalletReady({
      supabase: options.supabase,
      userId: options.userId,
      appInstanceId: options.appContext.appInstanceId,
    });

    if (!walletReady && !(skipWalletSetup && allowsWalletSkip(options.appContext.environment))) {
      throw new Error("Wallet setup is incomplete.");
    }
  }

  const { error: updateError } = await options.supabase
    .from("app_user_profiles")
    .update({
      metadata: buildUpdatedMetadata({
        currentMetadata: appProfile.metadata,
        signup: nextSignup,
      }),
      onboarding_state: buildUpdatedOnboardingState(appProfile.onboarding_state, nextSignup.currentStep),
      updated_at: nowIso,
    })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (updateError) {
    throw new Error(`Failed to save signup progress: ${updateError.message}`);
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function resetSignup(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const bootstrap = await getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });

  if (bootstrap.signup.state === "completed") {
    throw new Error("Completed signup cannot be reset.");
  }

  const nowIso = new Date().toISOString();

  const [{ error: userResetError }, { error: profileResetError }] = await Promise.all([
    options.supabase
      .from("users")
      .update({
        full_name: null,
        nickname: null,
        username: null,
        country: null,
        profile_image_url: null,
      })
      .eq("id", options.userId),
    options.supabase
      .from("app_user_profiles")
      .update({
        charity_preferences: null,
        metadata: buildUpdatedMetadata({
          currentMetadata: appProfile.metadata,
          signup: null,
        }),
        onboarding_state: buildUpdatedOnboardingState(appProfile.onboarding_state, null),
        updated_at: nowIso,
      })
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appContext.appInstanceId),
  ]);

  if (userResetError) {
    throw new Error(`Failed to reset user details: ${userResetError.message}`);
  }

  if (profileResetError) {
    throw new Error(`Failed to reset signup profile state: ${profileResetError.message}`);
  }

  await clearBiaSelection({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function completeSignup(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const bootstrap = await getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });

  const requiredSteps = [1, 2, 3, 4, 5];
  const hasAllSteps = requiredSteps.every((step) =>
    bootstrap.signup.completedSteps.includes(step as 1 | 2 | 3 | 4 | 5 | 6)
  );
  const walletRequirementSatisfied = bootstrap.signup.walletReady || allowsWalletSkip(options.appContext.environment);

  if (!hasAllSteps || !walletRequirementSatisfied) {
    throw new Error("Signup is incomplete.");
  }

  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const existingSignup = resolveSignupMetadata(ensureObject(appProfile.metadata).signup);
  const nowIso = new Date().toISOString();

  const [{ error: userUpdateError }, { error: profileUpdateError }] = await Promise.all([
    options.supabase
      .from("users")
      .update({
        has_completed_intro: true,
        is_new_user: false,
      })
      .eq("id", options.userId),
    options.supabase
      .from("app_user_profiles")
      .update({
        metadata: buildUpdatedMetadata({
          currentMetadata: appProfile.metadata,
          signup: {
            flow: "general-user-v1",
            status: "completed",
            currentStep: 6,
            completedSteps: [1, 2, 3, 4, 5, 6],
            startedAt: existingSignup.startedAt ?? nowIso,
            lastSavedAt: nowIso,
            completedAt: nowIso,
            phoneVerified: bootstrap.signup.phoneVerified,
          },
        }),
        onboarding_state: buildUpdatedOnboardingState(appProfile.onboarding_state, 6),
        updated_at: nowIso,
      })
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appContext.appInstanceId),
  ]);

  if (userUpdateError) {
    throw new Error(`Failed to mark signup completed: ${userUpdateError.message}`);
  }

  if (profileUpdateError) {
    throw new Error(`Failed to finalize signup state: ${profileUpdateError.message}`);
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

function mapBootstrapToCubidData(bootstrap: Awaited<ReturnType<typeof getUserSettingsBootstrap>>): any {
  return {
    id: bootstrap.user.id,
    cubid_id: bootstrap.user.cubidId,
    username: bootstrap.user.username,
    email: bootstrap.user.email,
    phone: bootstrap.user.phone,
    full_name: bootstrap.user.fullName,
    address: null,
    bio: null,
    profile_image_url: bootstrap.user.profileImageUrl,
    has_completed_intro: bootstrap.user.hasCompletedIntro,
    is_new_user: bootstrap.user.isNewUser,
    is_admin: null,
    auth_user_id: null,
    cubid_score: null,
    cubid_identity: null,
    cubid_score_details: null,
    updated_at: null,
    created_at: null,
    user_identifier: null,
    given_names: bootstrap.user.firstName || null,
    family_name: bootstrap.user.lastName || null,
    nickname: bootstrap.user.nickname,
    country: bootstrap.user.country,
    profiles: {
      [bootstrap.app.appSlug]: {
        appInstanceId: bootstrap.app.appInstanceId,
        slug: bootstrap.app.appSlug,
        persona: null,
        tippingPreferences: {
          preferredDonationAmount: null,
          goodTip: null,
          defaultTip: null,
        },
        charityPreferences: {
          selectedCause: bootstrap.preferences.selectedCause,
          charity: bootstrap.preferences.charity,
        },
        onboardingState: {
          currentStep: bootstrap.signup.currentStep,
          category: null,
          style: null,
        },
        metadata: null,
        createdAt: null,
        updatedAt: null,
      },
    },
    activeProfileKey: bootstrap.app.appSlug,
    activeProfile: {
      appInstanceId: bootstrap.app.appInstanceId,
      slug: bootstrap.app.appSlug,
      persona: null,
      tippingPreferences: {
        preferredDonationAmount: null,
        goodTip: null,
        defaultTip: null,
      },
      charityPreferences: {
        selectedCause: bootstrap.preferences.selectedCause,
        charity: bootstrap.preferences.charity,
      },
      onboardingState: {
        currentStep: bootstrap.signup.currentStep,
        category: null,
        style: null,
      },
      metadata: null,
      createdAt: null,
      updatedAt: null,
    },
  };
}

export async function ensureAuthenticatedUserRecord(options: {
  supabase: any;
  authUser: { id: string; email?: string | null; phone?: string | null };
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  authMethod?: string | null;
  fullContact?: string | null;
  cubidId?: string | null;
}) {
  const contact = toNullableString(options.fullContact);
  const authMethod = toNullableString(options.authMethod)?.toLowerCase();

  const lookupQueries = [
    options.supabase.from("users").select("id").eq("auth_user_id", options.authUser.id).limit(1).maybeSingle(),
    options.authUser.email
      ? options.supabase.from("users").select("id").eq("email", options.authUser.email).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    authMethod === "phone" && contact
      ? options.supabase.from("users").select("id").eq("phone", contact).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    authMethod !== "phone" && contact
      ? options.supabase.from("users").select("id").eq("email", contact).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ];

  const results = await Promise.all(lookupQueries);
  for (const result of results) {
    if (result.error) {
      throw new Error(`Failed to resolve user row: ${result.error.message}`);
    }
  }

  const existing = results.map((result) => result.data).find((row) => row?.id);
  let userId = toInteger(existing?.id);
  let created = false;

  if (userId == null) {
    const cubidId = toNullableString(options.cubidId);
    if (!cubidId) {
      throw new Error("cubidId is required when creating a new authenticated user.");
    }

    const payload: Record<string, unknown> = {
      cubid_id: cubidId,
      has_completed_intro: false,
      is_new_user: true,
      auth_user_id: options.authUser.id,
    };

    if (authMethod === "phone" && contact) {
      payload.phone = contact;
    } else if (contact) {
      payload.email = contact;
    } else if (options.authUser.email) {
      payload.email = options.authUser.email;
    }

    const { data: inserted, error: insertError } = await options.supabase
      .from("users")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create user row: ${insertError.message}`);
    }

    userId = toInteger(inserted?.id);
    created = true;
  } else {
    const patch: Record<string, unknown> = {
      auth_user_id: options.authUser.id,
    };
    if (options.authUser.email) {
      patch.email = options.authUser.email;
    }
    if (authMethod === "phone" && contact) {
      patch.phone = contact;
    }

    const { error: updateError } = await options.supabase.from("users").update(patch).eq("id", userId);
    if (updateError) {
      throw new Error(`Failed to update authenticated user row: ${updateError.message}`);
    }
  }

  if (userId == null) {
    throw new Error("Unable to resolve authenticated user id.");
  }

  const bootstrap = await getUserSettingsBootstrap({
    supabase: options.supabase,
    userId,
    appContext: options.appContext,
  });

  return {
    created,
    user: mapBootstrapToCubidData(bootstrap),
  };
}

export async function listPersonas(options: { supabase: any }) {
  const { data, error } = await options.supabase.from("ref_personas").select("*").order("sequential_id", { ascending: true });
  if (error) {
    throw new Error(`Failed to load personas: ${error.message}`);
  }
  return {
    personas: data ?? [],
  };
}

export async function registerWalletCustody(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  payload: JsonRecord;
}) {
  const walletKeyPayload = isRecord(options.payload.walletKey) ? { ...options.payload.walletKey } : {};
  const walletPayload = isRecord(options.payload.wallet) ? { ...options.payload.wallet } : {};
  const userSharePayload = isRecord(options.payload.userShare) ? { ...options.payload.userShare } : {};
  const namespace = toNullableString(walletPayload.namespace ?? walletKeyPayload.namespace) ?? "EVM";

  const nowIso = new Date().toISOString();
  const walletKeyInsert = {
    user_id: options.userId,
    namespace,
    ...walletKeyPayload,
    updated_at: nowIso,
  };

  const { data: walletKeyRow, error: walletKeyError } = await options.supabase
    .from("wallet_keys")
    .upsert(walletKeyInsert, { onConflict: "user_id,namespace" })
    .select("id")
    .single();

  if (walletKeyError) {
    throw new Error(`Failed to upsert wallet key: ${walletKeyError.message}`);
  }

  const walletKeyId = walletKeyRow?.id;
  if (walletKeyId == null) {
    throw new Error("Wallet key id is missing after upsert.");
  }

  const walletWritePayload: Record<string, unknown> = {
    user_id: options.userId,
    namespace,
    wallet_key_id: walletKeyId,
    ...walletPayload,
  };
  delete walletWritePayload.app_share;

  const { data: existingWallet, error: existingWalletError } = await options.supabase
    .from("wallet_list")
    .select("id")
    .eq("user_id", options.userId)
    .eq("namespace", namespace)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingWalletError) {
    throw new Error(`Failed to resolve wallet list row: ${existingWalletError.message}`);
  }

  let walletId: number | string | null = existingWallet?.id ?? null;
  if (walletId != null) {
    const { error: walletUpdateError } = await options.supabase
      .from("wallet_list")
      .update(walletWritePayload)
      .eq("id", walletId);
    if (walletUpdateError) {
      throw new Error(`Failed to update wallet list: ${walletUpdateError.message}`);
    }
  } else {
    const { data: insertedWallet, error: walletInsertError } = await options.supabase
      .from("wallet_list")
      .insert(walletWritePayload)
      .select("id")
      .single();
    if (walletInsertError) {
      throw new Error(`Failed to insert wallet list row: ${walletInsertError.message}`);
    }
    walletId = insertedWallet?.id ?? null;
  }

  const credentialId = toNullableString(userSharePayload.credential_id);
  const encryptedShare =
    userSharePayload.user_share_encrypted && isRecord(userSharePayload.user_share_encrypted)
      ? userSharePayload.user_share_encrypted
      : null;

  if (!encryptedShare) {
    throw new Error("user_share_encrypted is required.");
  }

  const { error: shareError } = await options.supabase
    .from("user_encrypted_share")
    .upsert(
      {
        user_share_encrypted: encryptedShare,
        user_id: options.userId,
        wallet_key_id: walletKeyId,
        credential_id: credentialId,
        app_instance_id: options.appContext.appInstanceId,
        device_info:
          userSharePayload.device_info && isRecord(userSharePayload.device_info)
            ? userSharePayload.device_info
            : null,
        revoked_at: null,
        last_used_at: nowIso,
      },
      { onConflict: "wallet_key_id,app_instance_id,credential_id" }
    );

  if (shareError) {
    throw new Error(`Failed to upsert encrypted user share: ${shareError.message}`);
  }

  const bootstrap = await getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });

  return {
    walletKeyId,
    walletId,
    bootstrap,
  };
}

export async function getWalletCustodyMaterial(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const [{ data: walletRow, error: walletError }, { data: shareRows, error: shareError }] = await Promise.all([
    options.supabase
      .from("wallet_list")
      .select("id,public_key,wallet_key_id")
      .eq("user_id", options.userId)
      .eq("namespace", "EVM")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("user_encrypted_share")
      .select("id,user_share_encrypted,credential_id,app_instance_id,last_used_at,created_at,revoked_at")
      .eq("user_id", options.userId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .is("revoked_at", null)
      .order("last_used_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (walletError) {
    throw new Error(`Failed to load wallet custody: ${walletError.message}`);
  }
  if (shareError) {
    throw new Error(`Failed to load encrypted user shares: ${shareError.message}`);
  }

  const walletKeyId = walletRow?.wallet_key_id;
  if (!walletKeyId) {
    throw new Error("No wallet_key_id found for this user.");
  }

  const { data: walletKey, error: walletKeyError } = await options.supabase
    .from("wallet_keys")
    .select("app_share")
    .eq("id", walletKeyId)
    .single();

  if (walletKeyError) {
    throw new Error(`Failed to load wallet key: ${walletKeyError.message}`);
  }

  return {
    appInstanceId: options.appContext.appInstanceId,
    appSlug: options.appContext.appSlug,
    primaryWallet: toNullableString(walletRow?.public_key),
    walletKeyId,
    appShare: toNullableString(walletKey?.app_share),
    shares: (shareRows ?? []).map((row: any) => ({
      id: row.id,
      credentialId: toNullableString(row.credential_id),
      appInstanceId: toInteger(row.app_instance_id),
      lastUsedAt: toNullableString(row.last_used_at),
      createdAt: toNullableString(row.created_at),
      userShareEncrypted: isRecord(row.user_share_encrypted) ? row.user_share_encrypted : null,
    })),
  };
}

export async function getLegacyCubidData(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const bootstrap = await getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });

  return mapBootstrapToCubidData(bootstrap);
}

export async function updateLegacyCubidData(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
  payload: JsonRecord;
}) {
  const payload = ensureObject(options.payload);
  const userPayload = ensureObject(payload.user);
  const profilePayload = ensureObject(payload.profile);

  if (Object.keys(userPayload).length > 0) {
    const { error: updateError } = await options.supabase.from("users").update(userPayload).eq("id", options.userId);
    if (updateError) {
      throw new Error(`Failed to update legacy user data: ${updateError.message}`);
    }
  }

  if (Object.keys(profilePayload).length > 0) {
    const profileUpdatePayload: JsonRecord = {};

    if ("persona" in profilePayload) {
      profileUpdatePayload.persona = toNullableString(profilePayload.persona);
    }

    if ("tippingPreferences" in profilePayload) {
      const tipping = ensureObject(profilePayload.tippingPreferences);
      profileUpdatePayload.tipping_preferences = {
        preferred_donation_amount:
          "preferredDonationAmount" in tipping ? toNullableNumber(tipping.preferredDonationAmount) : null,
        good_tip: "goodTip" in tipping ? toNullableInteger(tipping.goodTip) : null,
        default_tip: "defaultTip" in tipping ? toNullableInteger(tipping.defaultTip) : null,
      };
    }

    if ("charityPreferences" in profilePayload) {
      const charity = ensureObject(profilePayload.charityPreferences);
      profileUpdatePayload.charity_preferences = {
        selected_cause: "selectedCause" in charity ? toNullableString(charity.selectedCause) : null,
        charity: "charity" in charity ? toNullableString(charity.charity) : null,
      };
    }

    if ("onboardingState" in profilePayload) {
      const onboarding = ensureObject(profilePayload.onboardingState);
      profileUpdatePayload.onboarding_state = {
        current_step: "currentStep" in onboarding ? toNullableInteger(onboarding.currentStep) : null,
        category: "category" in onboarding ? toNullableString(onboarding.category) : null,
        style: "style" in onboarding ? toNullableInteger(onboarding.style) : null,
      };
    }

    if ("metadata" in profilePayload) {
      profileUpdatePayload.metadata = isRecord(profilePayload.metadata)
        ? (profilePayload.metadata as JsonRecord)
        : null;
    }

    if (Object.keys(profileUpdatePayload).length > 0) {
      const appProfile = await ensureAppProfile({
        supabase: options.supabase,
        userId: options.userId,
        appInstanceId: options.appContext.appInstanceId,
      });

      const { error: profileError } = await options.supabase
        .from("app_user_profiles")
        .update({
          ...profileUpdatePayload,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", options.userId)
        .eq("app_instance_id", appProfile.app_instance_id);

      if (profileError) {
        throw new Error(`Failed to update legacy profile data: ${profileError.message}`);
      }
    }
  }

  return getLegacyCubidData(options);
}
