type JsonRecord = Record<string, unknown>;

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTO_USER_IDENTIFIER_PREFIX = "user-";
const SIGNUP_FLOW_VERSION = "general-user-v2";

type ManagedEmailInput = {
  email: string;
  isPrimary: boolean;
};

type UserEmailRow = {
  id: number | null;
  email: string;
  isPrimary: boolean;
  createdAt: string | null;
};

type PendingPaymentIntent = {
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

export function normaliseEmailAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalised = value.trim().toLowerCase();
  if (!normalised || !EMAIL_PATTERN.test(normalised)) {
    return null;
  }

  return normalised;
}

export function normaliseManagedEmails(value: unknown): ManagedEmailInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Emails must be provided as a list.");
  }

  const deduped = new Map<string, ManagedEmailInput>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      throw new Error("Each email entry must be an object.");
    }

    const email = normaliseEmailAddress(entry.email);
    if (!email) {
      throw new Error("Each email must be a valid email address.");
    }

    const next = deduped.get(email) ?? { email, isPrimary: false };
    next.isPrimary = next.isPrimary || entry.isPrimary === true;
    deduped.set(email, next);
  }

  const emails = Array.from(deduped.values());
  if (emails.length === 0) {
    throw new Error("At least one email address is required.");
  }

  if (emails.length === 1) {
    return [{ ...emails[0], isPrimary: true }];
  }

  const primaryEmails = emails.filter((entry) => entry.isPrimary);
  if (primaryEmails.length !== 1) {
    throw new Error("Select exactly one primary email address.");
  }

  const primaryEmail = primaryEmails[0]?.email;
  return emails.map((entry) => ({
    email: entry.email,
    isPrimary: entry.email === primaryEmail,
  }));
}

export function normaliseUserIdentifierCandidate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-._]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");

  if (normalised.length < 3) {
    return null;
  }

  return normalised.slice(0, 32);
}

export function buildFallbackUserIdentifier(userId: number): string {
  return `${AUTO_USER_IDENTIFIER_PREFIX}${userId}`;
}

export function isFallbackUserIdentifier(value: unknown, userId: number): boolean {
  return toNullableString(value)?.toLowerCase() === buildFallbackUserIdentifier(userId);
}

export function buildUserIdentifierVariant(base: string, suffix: number): string {
  if (suffix <= 0) {
    return base;
  }

  const suffixText = `-${suffix}`;
  const trimmedBase = base.slice(0, Math.max(3, 32 - suffixText.length)).replace(/[-._]+$/g, "");
  return `${trimmedBase}${suffixText}`;
}

async function ensureUserIdentifier(options: {
  supabase: any;
  userId: number;
  preferredCandidate?: unknown;
  replaceFallback?: boolean;
}) {
  const { data: userRow, error: userError } = await options.supabase
    .from("users")
    .select("id,username,user_identifier")
    .eq("id", options.userId)
    .limit(1)
    .maybeSingle();

  if (userError) {
    throw new Error(`Failed to load user identifier state: ${userError.message}`);
  }

  const currentIdentifier = toNullableString(userRow?.user_identifier);
  const shouldReplaceFallback = options.replaceFallback === true && isFallbackUserIdentifier(currentIdentifier, options.userId);

  if (currentIdentifier && !shouldReplaceFallback) {
    return currentIdentifier;
  }

  const baseIdentifier =
    normaliseUserIdentifierCandidate(options.preferredCandidate) ??
    normaliseUserIdentifierCandidate(userRow?.username) ??
    buildFallbackUserIdentifier(options.userId);

  let suffix = 0;
  let nextIdentifier = buildUserIdentifierVariant(baseIdentifier, suffix);

  while (true) {
    const { data: existingUser, error: existingError } = await options.supabase
      .from("users")
      .select("id")
      .eq("user_identifier", nextIdentifier)
      .neq("id", options.userId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to validate user identifier: ${existingError.message}`);
    }

    if (!existingUser?.id) {
      break;
    }

    suffix += 1;
    nextIdentifier = buildUserIdentifierVariant(baseIdentifier, suffix);
  }

  const { error: updateError } = await options.supabase
    .from("users")
    .update({
      user_identifier: nextIdentifier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.userId);

  if (updateError) {
    throw new Error(`Failed to persist user identifier: ${updateError.message}`);
  }

  return nextIdentifier;
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

export function normaliseExperienceMode(value: unknown): "simple" | "advanced" {
  return value === "advanced" ? "advanced" : "simple";
}

function resolveStoredExperienceMode(value: unknown): "simple" | "advanced" | null {
  if (value === "simple" || value === "advanced") {
    return value;
  }
  return null;
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
        .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7)
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

export function normalisePendingPaymentIntent(value: unknown): PendingPaymentIntent | null {
  if (!isRecord(value)) {
    return null;
  }

  const recipientUserId = toNullableInteger(value.recipientUserId);
  if (recipientUserId == null) {
    return null;
  }

  return {
    recipientUserId,
    recipientName: toNullableString(value.recipientName),
    recipientUsername: toNullableString(value.recipientUsername),
    recipientProfileImageUrl: toNullableString(value.recipientProfileImageUrl),
    recipientWalletAddress: toNullableString(value.recipientWalletAddress),
    recipientUserIdentifier: toNullableString(value.recipientUserIdentifier),
    amountRequested: toNullableNumber(value.amountRequested),
    sourceToken: toNullableString(value.sourceToken),
    sourceMode:
      value.sourceMode === "single_use" || value.sourceMode === "rotating_multi_use"
        ? value.sourceMode
        : null,
    createdAt: toNullableString(value.createdAt),
  };
}

function resolveSignupMetadata(value: unknown) {
  const metadata = ensureObject(value);

  return {
    flow: typeof metadata.flow === "string" ? metadata.flow : "general-user-v1",
    status: metadata.status === "completed" ? "completed" : metadata.status === "draft" ? "draft" : null,
    currentStep: (() => {
      const parsed = Number(metadata.currentStep);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7 ? parsed : null;
    })(),
    completedSteps: dedupeStepList(metadata.completedSteps),
    startedAt: toNullableString(metadata.startedAt),
    lastSavedAt: toNullableString(metadata.lastSavedAt),
    completedAt: toNullableString(metadata.completedAt),
    phoneVerified: metadata.phoneVerified === true,
    pendingPaymentIntent: normalisePendingPaymentIntent(metadata.pendingPaymentIntent),
  };
}

function normaliseSignupForExperienceMode(options: {
  signup: ReturnType<typeof resolveSignupMetadata>;
  hasExplicitExperienceMode: boolean;
}) {
  const { signup, hasExplicitExperienceMode } = options;
  if (signup.status !== "draft" || hasExplicitExperienceMode || signup.flow === SIGNUP_FLOW_VERSION) {
    return signup;
  }

  return {
    ...signup,
    currentStep: signup.currentStep != null && signup.currentStep >= 5 ? 5 : signup.currentStep,
    completedSteps: Array.from(
      new Set(
        signup.completedSteps.map((step) => {
          if (step === 5) {
            return 6;
          }
          if (step === 6) {
            return 7;
          }
          return step;
        })
      )
    ).sort((a, b) => a - b),
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

export async function getLatestWalletListRow<T>(options: {
  supabase: any;
  userId: number;
  select: string;
  namespace?: string;
}): Promise<{ data: T | null; error: any }> {
  const namespace = options.namespace ?? "EVM";

  return options.supabase
    .from("wallet_list")
    .select(options.select)
    .eq("user_id", options.userId)
    .eq("namespace", namespace)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
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

async function loadActiveUserEmails(options: {
  supabase: any;
  userId: number;
  fallbackEmail?: string | null;
}): Promise<UserEmailRow[]> {
  const { data, error } = await options.supabase
    .from("user_email_addresses")
    .select("id,email,is_primary,created_at")
    .eq("user_id", options.userId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message)) {
      const fallbackEmail = normaliseEmailAddress(options.fallbackEmail);
      return fallbackEmail
        ? [
            {
              id: null,
              email: fallbackEmail,
              isPrimary: true,
              createdAt: null,
            },
          ]
        : [];
    }

    throw new Error(`Failed to load user emails: ${error.message}`);
  }

  const emails = (data ?? [])
    .map((row: any) => ({
      id: toNullableInteger(row.id),
      email: normaliseEmailAddress(row.email),
      isPrimary: row.is_primary === true,
      createdAt: toNullableString(row.created_at),
    }))
    .filter((row: UserEmailRow) => Boolean(row.email)) as UserEmailRow[];

  if (emails.length > 0) {
    return emails;
  }

  const fallbackEmail = normaliseEmailAddress(options.fallbackEmail);
  return fallbackEmail
    ? [
        {
          id: null,
          email: fallbackEmail,
          isPrimary: true,
          createdAt: null,
        },
      ]
    : [];
}

async function syncUserEmailAddresses(options: {
  supabase: any;
  userId: number;
  emails: ManagedEmailInput[];
}) {
  const normalisedEmails = normaliseManagedEmails(options.emails);
  const primaryEmail = normalisedEmails.find((entry) => entry.isPrimary)?.email ?? normalisedEmails[0]?.email ?? null;

  const { data: existingRows, error: existingError } = await options.supabase
    .from("user_email_addresses")
    .select("id,email,is_primary")
    .eq("user_id", options.userId)
    .is("deleted_at", null);

  if (existingError) {
    if (isMissingTableError(existingError.message)) {
      if (normalisedEmails.length > 1) {
        throw new Error("Multiple email addresses are not configured in this environment.");
      }

      const { error: fallbackUpdateError } = await options.supabase
        .from("users")
        .update({
          email: primaryEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", options.userId);

      if (fallbackUpdateError) {
        throw new Error(`Failed to update primary email: ${fallbackUpdateError.message}`);
      }

      return;
    }

    throw new Error(`Failed to load user email state: ${existingError.message}`);
  }

  const { data: conflictingRows, error: conflictingError } = await options.supabase
    .from("user_email_addresses")
    .select("id,email,user_id")
    .in(
      "email",
      normalisedEmails.map((entry) => entry.email)
    )
    .is("deleted_at", null)
    .neq("user_id", options.userId);

  if (conflictingError) {
    throw new Error(`Failed to validate email availability: ${conflictingError.message}`);
  }

  if ((conflictingRows ?? []).length > 0) {
    throw new Error("One of those email addresses is already connected to another active account.");
  }

  const existingByEmail = new Map<string, { id: number; email: string; isPrimary: boolean }>();
  for (const row of existingRows ?? []) {
    const email = normaliseEmailAddress(row.email);
    const id = toNullableInteger(row.id);
    if (!email || id == null) {
      continue;
    }
    existingByEmail.set(email, {
      id,
      email,
      isPrimary: row.is_primary === true,
    });
  }

  const nowIso = new Date().toISOString();
  const requestedEmails = new Set(normalisedEmails.map((entry) => entry.email));
  const removedRowIds = Array.from(existingByEmail.values())
    .filter((row) => !requestedEmails.has(row.email))
    .map((row) => row.id);

  if (removedRowIds.length > 0) {
    const { error: deleteError } = await options.supabase
      .from("user_email_addresses")
      .update({
        is_primary: false,
        deleted_at: nowIso,
        updated_at: nowIso,
      })
      .in("id", removedRowIds);

    if (deleteError) {
      throw new Error(`Failed to retire removed emails: ${deleteError.message}`);
    }
  }

  for (const entry of normalisedEmails) {
    const existingRow = existingByEmail.get(entry.email);
    if (existingRow) {
      if (existingRow.isPrimary === entry.isPrimary) {
        continue;
      }

      const { error: updateError } = await options.supabase
        .from("user_email_addresses")
        .update({
          is_primary: entry.isPrimary,
          updated_at: nowIso,
        })
        .eq("id", existingRow.id);

      if (updateError) {
        throw new Error(`Failed to update email status: ${updateError.message}`);
      }

      continue;
    }

    const { error: insertError } = await options.supabase.from("user_email_addresses").insert({
      user_id: options.userId,
      email: entry.email,
      is_primary: entry.isPrimary,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (insertError) {
      throw new Error(`Failed to save email address: ${insertError.message}`);
    }
  }

  const { error: userUpdateError } = await options.supabase
    .from("users")
    .update({
      email: primaryEmail,
      updated_at: nowIso,
    })
    .eq("id", options.userId);

  if (userUpdateError) {
    throw new Error(`Failed to update primary email: ${userUpdateError.message}`);
  }
}

async function ensureUserEmailsPresent(options: {
  supabase: any;
  userId: number;
  emails: string[];
}) {
  const existingEmails = await loadActiveUserEmails({
    supabase: options.supabase,
    userId: options.userId,
  });

  const requested = Array.from(
    new Set(options.emails.map((value) => normaliseEmailAddress(value)).filter((value): value is string => Boolean(value)))
  );

  if (requested.length === 0) {
    return;
  }

  const existingByEmail = new Map(existingEmails.map((entry) => [entry.email, entry]));
  const merged = existingEmails.map((entry) => ({
    email: entry.email,
    isPrimary: entry.isPrimary,
  }));

  for (const email of requested) {
    if (!existingByEmail.has(email)) {
      merged.push({
        email,
        isPrimary: merged.length === 0,
      });
    }
  }

  if (!merged.some((entry) => entry.isPrimary) && merged.length > 0) {
    merged[0]!.isPrimary = true;
  }

  await syncUserEmailAddresses({
    supabase: options.supabase,
    userId: options.userId,
    emails: merged,
  });
}

async function findUserIdByEmail(options: {
  supabase: any;
  email: string;
}): Promise<number | null> {
  const normalisedEmail = normaliseEmailAddress(options.email);
  if (!normalisedEmail) {
    return null;
  }

  const { data, error } = await options.supabase
    .from("user_email_addresses")
    .select("user_id")
    .eq("email", normalisedEmail)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error.message)) {
      throw new Error(`Failed to resolve user by email history: ${error.message}`);
    }
  } else {
    const userId = toNullableInteger(data?.user_id);
    if (userId != null) {
      return userId;
    }
  }

  const { data: fallbackData, error: fallbackError } = await options.supabase
    .from("users")
    .select("id")
    .eq("email", normalisedEmail)
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(`Failed to resolve user by email: ${fallbackError.message}`);
  }

  return toNullableInteger(fallbackData?.id);
}

function buildUpdatedMetadata(options: {
  currentMetadata: unknown;
  theme?: "system" | "light" | "dark";
  experienceMode?: "simple" | "advanced" | null;
  signup?: JsonRecord | null;
}) {
  const metadata = ensureObject(options.currentMetadata);

  if (options.theme || options.experienceMode !== undefined) {
    const appearance = ensureObject(metadata.appearance);
    if (options.theme) {
      appearance.theme = options.theme;
    }
    if (options.experienceMode === null) {
      delete appearance.experienceMode;
    } else if (options.experienceMode) {
      appearance.experienceMode = options.experienceMode;
    }

    if (Object.keys(appearance).length === 0) {
      delete metadata.appearance;
    } else {
      metadata.appearance = appearance;
    }
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
          "id,cubid_id,user_identifier,email,phone,full_name,nickname,username,country,address,profile_image_url,has_completed_intro,is_new_user"
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
  const storedExperienceMode = resolveStoredExperienceMode(appearance.experienceMode);
  const signup = normaliseSignupForExperienceMode({
    signup: resolveSignupMetadata(metadata.signup),
    hasExplicitExperienceMode: storedExperienceMode != null,
  });
  const charityPreferences = ensureObject(appProfile.charity_preferences);
  const { firstName, lastName } = splitFullName(toNullableString(userRow.full_name));
  const emails = await loadActiveUserEmails({
    supabase: options.supabase,
    userId: options.userId,
    fallbackEmail: toNullableString(userRow.email),
  });
  const primaryEmail = emails.find((entry) => entry.isPrimary)?.email ?? emails[0]?.email ?? toNullableString(userRow.email);

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
      userIdentifier: toNullableString(userRow.user_identifier),
      email: primaryEmail,
      emails,
      phone: toNullableString(userRow.phone),
      fullName: toNullableString(userRow.full_name),
      firstName,
      lastName,
      nickname: toNullableString(userRow.nickname),
      username: toNullableString(userRow.username),
      country: toNullableString(userRow.country),
      address: toNullableString(userRow.address),
      profileImageUrl: toNullableString(userRow.profile_image_url),
      hasCompletedIntro: Boolean(userRow.has_completed_intro),
      isNewUser: typeof userRow.is_new_user === "boolean" ? userRow.is_new_user : null,
    },
    app: options.appContext,
    preferences: {
      theme: normaliseTheme(appearance.theme),
      experienceMode: normaliseExperienceMode(storedExperienceMode),
      hasExplicitExperienceMode: storedExperienceMode != null,
      charity: toNullableString(charityPreferences.charity),
      selectedCause: toNullableString(charityPreferences.selected_cause),
      primaryBiaId: biaSelection.primaryBiaId,
      secondaryBiaIds: biaSelection.secondaryBiaIds,
    },
    signup: {
      flow: signup.flow,
      state: signupState,
      currentStep: signupState === "none" ? null : ((signup.currentStep ?? (signupState === "completed" ? 7 : 1)) as 1 | 2 | 3 | 4 | 5 | 6 | 7),
      completedSteps:
        signupState === "completed"
          ? [1, 2, 3, 4, 5, 6, 7]
          : (signup.completedSteps as Array<1 | 2 | 3 | 4 | 5 | 6 | 7>),
      walletReady,
      phoneVerified,
      pendingPaymentIntent: signup.pendingPaymentIntent,
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
  const emails = "emails" in options.payload ? normaliseManagedEmails(options.payload.emails) : undefined;
  const country = "country" in options.payload ? toNullableString(options.payload.country) : undefined;
  const address = "address" in options.payload ? toNullableString(options.payload.address) : undefined;
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
  if ("address" in options.payload) {
    updates.address = address;
  }
  if ("profileImageUrl" in options.payload) {
    updates.profile_image_url = profileImageUrl;
  }
  if ("username" in options.payload) {
    updates.username = username;
  }

  if (emails) {
    await syncUserEmailAddresses({
      supabase: options.supabase,
      userId: options.userId,
      emails,
    });
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await options.supabase.from("users").update(updates).eq("id", options.userId);
    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }
  }

  await ensureUserIdentifier({
    supabase: options.supabase,
    userId: options.userId,
    preferredCandidate: username ?? undefined,
    replaceFallback: true,
  });

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
    experienceMode:
      "experienceMode" in options.payload ? normaliseExperienceMode(options.payload.experienceMode) : undefined,
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
    flow: SIGNUP_FLOW_VERSION,
    status: "draft",
    currentStep: 1,
    completedSteps: [],
    startedAt: nowIso,
    lastSavedAt: nowIso,
    completedAt: null,
    phoneVerified: false,
    pendingPaymentIntent: signup.pendingPaymentIntent,
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
  if (!Number.isInteger(step) || step < 1 || step > 6) {
    throw new Error("Signup step must be between 1 and 6.");
  }

  const rawPayload = isRecord(options.payload.payload) ? options.payload.payload : {};
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const metadata = ensureObject(appProfile.metadata);
  const appearance = ensureObject(metadata.appearance);
  const storedExperienceMode = resolveStoredExperienceMode(appearance.experienceMode);
  const existingSignup = normaliseSignupForExperienceMode({
    signup: resolveSignupMetadata(metadata.signup),
    hasExplicitExperienceMode: storedExperienceMode != null,
  });
  const nowIso = new Date().toISOString();

  const nextSignup = {
    flow: SIGNUP_FLOW_VERSION,
    status: "draft",
    currentStep: Math.min(7, step + 1),
    completedSteps: Array.from(new Set([...(existingSignup.completedSteps ?? []), step])).sort((a, b) => a - b),
    startedAt: existingSignup.startedAt ?? nowIso,
    lastSavedAt: nowIso,
    completedAt: null,
    phoneVerified: existingSignup.phoneVerified,
    pendingPaymentIntent: existingSignup.pendingPaymentIntent,
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
    const experienceMode = resolveStoredExperienceMode(rawPayload.experienceMode);
    if (!experienceMode) {
      throw new Error("Choose either clean and simple mode or advanced mode.");
    }

    await updateUserPreferences({
      supabase: options.supabase,
      userId: options.userId,
      appContext: options.appContext,
      payload: {
        experienceMode,
      },
    });
  }

  if (step === 6) {
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
          experienceMode: null,
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

  const requiredSteps = [1, 2, 3, 4, 5, 6];
  const hasAllSteps = requiredSteps.every((step) =>
    bootstrap.signup.completedSteps.includes(step as 1 | 2 | 3 | 4 | 5 | 6 | 7)
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
            flow: SIGNUP_FLOW_VERSION,
            status: "completed",
            currentStep: 7,
            completedSteps: [1, 2, 3, 4, 5, 6, 7],
            startedAt: existingSignup.startedAt ?? nowIso,
            lastSavedAt: nowIso,
            completedAt: nowIso,
            phoneVerified: bootstrap.signup.phoneVerified,
            pendingPaymentIntent: existingSignup.pendingPaymentIntent,
          },
        }),
        onboarding_state: buildUpdatedOnboardingState(appProfile.onboarding_state, 7),
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

export async function savePendingPaymentIntent(options: {
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
  const existingSignup = resolveSignupMetadata(ensureObject(appProfile.metadata).signup);
  const pendingPaymentIntent = normalisePendingPaymentIntent(options.payload);

  if (!pendingPaymentIntent) {
    throw new Error("A valid pending payment intent is required.");
  }

  const nextSignup = {
    ...existingSignup,
    pendingPaymentIntent,
  };

  const { error } = await options.supabase
    .from("app_user_profiles")
    .update({
      metadata: buildUpdatedMetadata({
        currentMetadata: appProfile.metadata,
        signup: nextSignup,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (error) {
    throw new Error(`Failed to save pending payment intent: ${error.message}`);
  }

  return getUserSettingsBootstrap({
    supabase: options.supabase,
    userId: options.userId,
    appContext: options.appContext,
  });
}

export async function clearPendingPaymentIntent(options: {
  supabase: any;
  userId: number;
  appContext: { appSlug: string; citySlug: string; environment: string; appInstanceId: number };
}) {
  const appProfile = await ensureAppProfile({
    supabase: options.supabase,
    userId: options.userId,
    appInstanceId: options.appContext.appInstanceId,
  });
  const existingSignup = resolveSignupMetadata(ensureObject(appProfile.metadata).signup);

  const nextSignup = {
    ...existingSignup,
    pendingPaymentIntent: null,
  };

  const { error } = await options.supabase
    .from("app_user_profiles")
    .update({
      metadata: buildUpdatedMetadata({
        currentMetadata: appProfile.metadata,
        signup: nextSignup,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId);

  if (error) {
    throw new Error(`Failed to clear pending payment intent: ${error.message}`);
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
    address: bootstrap.user.address,
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
    user_identifier: bootstrap.user.userIdentifier,
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
  const authEmail = normaliseEmailAddress(options.authUser.email);
  const contactEmail = authMethod === "phone" ? null : normaliseEmailAddress(contact);

  const [authUserRowResult, authEmailUserId, phoneContactResult, contactEmailUserId] = await Promise.all([
    options.supabase.from("users").select("id").eq("auth_user_id", options.authUser.id).limit(1).maybeSingle(),
    authEmail ? findUserIdByEmail({ supabase: options.supabase, email: authEmail }) : Promise.resolve(null),
    authMethod === "phone" && contact
      ? options.supabase.from("users").select("id").eq("phone", contact).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    contactEmail ? findUserIdByEmail({ supabase: options.supabase, email: contactEmail }) : Promise.resolve(null),
  ]);

  if (authUserRowResult.error) {
    throw new Error(`Failed to resolve user row: ${authUserRowResult.error.message}`);
  }
  if (phoneContactResult.error) {
    throw new Error(`Failed to resolve user row: ${phoneContactResult.error.message}`);
  }

  const existingCandidates = [
    toNullableInteger(authUserRowResult.data?.id),
    authEmailUserId,
    toNullableInteger(phoneContactResult.data?.id),
    contactEmailUserId,
  ].filter((value): value is number => value != null);

  let userId = existingCandidates[0] ?? null;
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
      payload.email = contactEmail ?? contact;
    } else if (authEmail) {
      payload.email = authEmail;
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
    if (authEmail) {
      patch.email = authEmail;
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

  const managedEmails = [contactEmail, authEmail].filter((value): value is string => Boolean(value));

  if (managedEmails.length > 0) {
    await ensureUserEmailsPresent({
      supabase: options.supabase,
      userId,
      emails: managedEmails,
    });
  }

  await ensureUserIdentifier({
    supabase: options.supabase,
    userId,
  });

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

  const { data: existingWallet, error: existingWalletError } = await getLatestWalletListRow<{
    id: number | string | null;
  }>({
    supabase: options.supabase,
    userId: options.userId,
    namespace,
    select: "id",
  });

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

  await ensureUserIdentifier({
    supabase: options.supabase,
    userId: options.userId,
  });

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
    getLatestWalletListRow<{
      id: number | string | null;
      public_key: string | null;
      wallet_key_id: number | string | null;
    }>({
      supabase: options.supabase,
      userId: options.userId,
      namespace: "EVM",
      select: "id,public_key,wallet_key_id",
    }),
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
