type PaymentRequestLinkMode = "rotating_multi_use" | "single_use";
type PaymentRequestLinkState = "ready" | "expired" | "consumed" | "invalid";

type EdgeAppContext = {
  appSlug: string;
  citySlug: string;
  environment: string;
  appInstanceId: number;
};

type PaymentRequestLinkRecipient = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletAddress: string | null;
  userIdentifier: string | null;
};

type PaymentRequestLinkResolution = {
  token: string;
  state: PaymentRequestLinkState;
  mode: PaymentRequestLinkMode | null;
  amountRequested: number | null;
  expiresAt: string | null;
  consumedAt: string | null;
  url: string | null;
  recipient: PaymentRequestLinkRecipient | null;
};

type LinkRow = Record<string, unknown>;

const DEFAULT_WALLET_PUBLIC_BASE_URL = "https://www.tcoin.me";

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

function normaliseMode(value: unknown): PaymentRequestLinkMode {
  return value === "single_use" ? "single_use" : "rotating_multi_use";
}

function assertValidAmount(value: unknown): number | null {
  const amount = toNullableNumber(value);
  if (amount == null) {
    return null;
  }
  if (amount < 0) {
    throw new Error("Amount requested cannot be negative.");
  }
  return amount;
}

function resolveWalletPublicBaseUrl(): string {
  return (
    toNullableString(Deno.env.get("WALLET_PUBLIC_BASE_URL")) ??
    toNullableString(Deno.env.get("NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL")) ??
    DEFAULT_WALLET_PUBLIC_BASE_URL
  ).replace(/\/$/, "");
}

function buildWalletPayUrl(token: string): string {
  return `${resolveWalletPublicBaseUrl()}/pay/${encodeURIComponent(token)}`;
}

function encodeBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateOpaqueToken(): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function loadRecipientSnapshot(options: {
  supabase: any;
  userId: number;
}): Promise<PaymentRequestLinkRecipient | null> {
  const [{ data: userRow, error: userError }, { data: walletRow, error: walletError }] = await Promise.all([
    options.supabase
      .from("users")
      .select("id,full_name,username,profile_image_url,user_identifier")
      .eq("id", options.userId)
      .limit(1)
      .maybeSingle(),
    options.supabase
      .from("wallet_list")
      .select("public_key")
      .eq("user_id", options.userId)
      .eq("namespace", "EVM")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (userError) {
    throw new Error(`Failed to load pay-link recipient: ${userError.message}`);
  }

  if (walletError) {
    throw new Error(`Failed to load pay-link wallet: ${walletError.message}`);
  }

  if (!userRow?.id) {
    return null;
  }

  return {
    id: Number(userRow.id),
    fullName: toNullableString(userRow.full_name),
    username: toNullableString(userRow.username),
    profileImageUrl: toNullableString(userRow.profile_image_url),
    walletAddress: toNullableString(walletRow?.public_key),
    userIdentifier: toNullableString(userRow.user_identifier),
  };
}

function buildResolution(options: {
  token: string;
  row?: LinkRow | null;
  recipient?: PaymentRequestLinkRecipient | null;
}): PaymentRequestLinkResolution {
  const row = options.row ?? null;
  if (!row) {
    return {
      token: options.token,
      state: "invalid",
      mode: null,
      amountRequested: null,
      expiresAt: null,
      consumedAt: null,
      url: null,
      recipient: null,
    };
  }

  const mode = normaliseMode(row.mode);
  const expiresAt = toNullableString(row.expires_at);
  const consumedAt = toNullableString(row.consumed_at);
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  const isConsumed = mode === "single_use" && consumedAt != null;

  return {
    token: options.token,
    state: isConsumed ? "consumed" : isExpired ? "expired" : "ready",
    mode,
    amountRequested: toNullableNumber(row.amount_requested),
    expiresAt,
    consumedAt,
    url: buildWalletPayUrl(options.token),
    recipient: options.recipient ?? null,
  };
}

async function findLinkRowByToken(options: {
  supabase: any;
  token: string;
}): Promise<LinkRow | null> {
  const tokenHash = await sha256Hex(options.token);
  const { data, error } = await options.supabase
    .from("payment_request_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment request link: ${error.message}`);
  }

  return (data as LinkRow | null) ?? null;
}

export async function createPaymentRequestLink(options: {
  supabase: any;
  appContext: EdgeAppContext;
  recipientUserId: number;
  amountRequested: unknown;
  mode?: unknown;
}) {
  const token = await generateOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const mode = normaliseMode(options.mode);
  const amountRequested = assertValidAmount(options.amountRequested);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() +
      (mode === "single_use" ? 30 * 24 * 60 * 60 * 1000 : 60 * 1000)
  ).toISOString();

  const { data, error } = await options.supabase
    .from("payment_request_links")
    .insert({
      token_hash: tokenHash,
      app_instance_id: options.appContext.appInstanceId,
      recipient_user_id: options.recipientUserId,
      amount_requested: amountRequested,
      mode,
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create payment request link: ${error.message}`);
  }

  const recipient = await loadRecipientSnapshot({
    supabase: options.supabase,
    userId: options.recipientUserId,
  });

  return {
    link: buildResolution({
      token,
      row: data as LinkRow,
      recipient,
    }),
  };
}

export async function resolvePaymentRequestLink(options: {
  supabase: any;
  token: string;
}) {
  const row = await findLinkRowByToken(options);
  const recipientUserId = toNullableInteger(row?.recipient_user_id);
  const recipient =
    recipientUserId != null
      ? await loadRecipientSnapshot({
          supabase: options.supabase,
          userId: recipientUserId,
        })
      : null;

  return {
    link: buildResolution({
      token: options.token,
      row,
      recipient,
    }),
  };
}

export async function consumePaymentRequestLink(options: {
  supabase: any;
  token: string;
  consumingUserId: number;
  transactionId?: unknown;
}) {
  const row = await findLinkRowByToken(options);
  const resolution = await resolvePaymentRequestLink({
    supabase: options.supabase,
    token: options.token,
  });

  if (!row) {
    return resolution;
  }

  if (resolution.link.mode !== "single_use" || resolution.link.state !== "ready") {
    return resolution;
  }

  const nowIso = new Date().toISOString();
  const { error } = await options.supabase
    .from("payment_request_links")
    .update({
      consumed_at: nowIso,
      consumed_by_user_id: options.consumingUserId,
      consumed_transaction_id: toNullableInteger(options.transactionId),
      updated_at: nowIso,
    })
    .eq("id", toNullableInteger(row.id))
    .is("consumed_at", null);

  if (error) {
    throw new Error(`Failed to consume payment request link: ${error.message}`);
  }

  return resolvePaymentRequestLink({
    supabase: options.supabase,
    token: options.token,
  });
}
