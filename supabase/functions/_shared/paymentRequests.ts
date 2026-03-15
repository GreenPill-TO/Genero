type PaymentRequestStatus = "pending" | "paid" | "dismissed" | "cancelled" | "expired";

type EdgeCityScope = {
  citycoinId: number;
  citySlug: string;
  appInstanceId: number | null;
};

type PaymentRequestRecord = {
  id: number;
  citycoinId: number | null;
  citySlug: string | null;
  originAppInstanceId: number | null;
  originAppSlug: string | null;
  requestBy: number | null;
  requestFrom: number | null;
  amountRequested: number | null;
  transactionId: number | string | null;
  status: PaymentRequestStatus;
  isOpen: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  requesterFullName: string | null;
  requesterUsername: string | null;
  requesterProfileImageUrl: string | null;
  requesterWalletPublicKey: string | null;
  recipientFullName: string | null;
  recipientUsername: string | null;
  recipientProfileImageUrl: string | null;
  recipientWalletPublicKey: string | null;
};

type RecentParticipantRecord = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletPublicKey: string | null;
  lastInteractionAt: string | null;
};

type RequestRow = Record<string, unknown>;

function normaliseNumber(value: unknown): number | null {
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

function normaliseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normaliseString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normaliseStatus(value: unknown): PaymentRequestStatus {
  const status = normaliseString(value)?.toLowerCase();
  if (
    status === "pending" ||
    status === "paid" ||
    status === "dismissed" ||
    status === "cancelled" ||
    status === "expired"
  ) {
    return status;
  }
  return "pending";
}

function normaliseTimestamp(value: unknown): string | null {
  return normaliseString(value);
}

function normalisePaymentRequest(row: RequestRow): PaymentRequestRecord {
  return {
    id: normaliseInteger(row.id) ?? 0,
    citycoinId: normaliseInteger(row.citycoin_id),
    citySlug: normaliseString(row.city_slug),
    originAppInstanceId: normaliseInteger(row.origin_app_instance_id),
    originAppSlug: normaliseString(row.origin_app_slug),
    requestBy: normaliseInteger(row.request_by),
    requestFrom: normaliseInteger(row.request_from),
    amountRequested: normaliseNumber(row.amount_requested),
    transactionId:
      typeof row.transaction_id === "string" || typeof row.transaction_id === "number"
        ? row.transaction_id
        : null,
    status: normaliseStatus(row.status),
    isOpen: row.is_open === true,
    isActive: row.is_active === true,
    createdAt: normaliseTimestamp(row.created_at),
    updatedAt: normaliseTimestamp(row.updated_at),
    paidAt: normaliseTimestamp(row.paid_at),
    closedAt: normaliseTimestamp(row.closed_at),
    requesterFullName: normaliseString(row.requester_full_name),
    requesterUsername: normaliseString(row.requester_username),
    requesterProfileImageUrl: normaliseString(row.requester_profile_image_url),
    requesterWalletPublicKey: normaliseString(row.requester_wallet_public_key),
    recipientFullName: normaliseString(row.recipient_full_name),
    recipientUsername: normaliseString(row.recipient_username),
    recipientProfileImageUrl: normaliseString(row.recipient_profile_image_url),
    recipientWalletPublicKey: normaliseString(row.recipient_wallet_public_key),
  };
}

function assertValidAmount(value: unknown): number | null {
  const amount = normaliseNumber(value);
  if (amount == null) {
    return null;
  }
  if (amount < 0) {
    throw new Error("Amount requested cannot be negative.");
  }
  return amount;
}

async function readPaymentRequestById(options: {
  supabase: any;
  citySlug: string;
  requestId: number;
}): Promise<PaymentRequestRecord | null> {
  const { data, error } = await options.supabase
    .from("v_payment_requests_v1")
    .select("*")
    .eq("id", options.requestId)
    .eq("city_slug", options.citySlug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payment request: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalisePaymentRequest(data as RequestRow);
}

async function insertTargetedNotification(options: {
  supabase: any;
  requesterId: number;
  requestFrom: number | null;
  amountRequested: number | null;
}) {
  if (options.requestFrom == null) {
    return;
  }

  try {
    const { data: requesterRow } = await options.supabase
      .from("users")
      .select("full_name,username")
      .eq("id", options.requesterId)
      .limit(1)
      .maybeSingle();

    const requesterLabel =
      normaliseString(requesterRow?.full_name) ??
      normaliseString(requesterRow?.username) ??
      `User #${options.requesterId}`;
    const amountLabel =
      typeof options.amountRequested === "number" && Number.isFinite(options.amountRequested)
        ? `${options.amountRequested.toFixed(2)} TCOIN`
        : "A payment";

    await options.supabase.from("notifications").insert({
      user_id: String(options.requestFrom),
      notification: `${amountLabel} request from ${requesterLabel}`,
    });
  } catch {
    // Best-effort notification only.
  }
}

export async function listIncomingPaymentRequests(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
}): Promise<PaymentRequestRecord[]> {
  const { data, error } = await options.supabase
    .from("v_payment_requests_v1")
    .select("*")
    .eq("city_slug", options.cityScope.citySlug)
    .eq("request_from", options.userId)
    .eq("status", "pending")
    .not("request_by", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load incoming payment requests: ${error.message}`);
  }

  return (data ?? []).map((row: RequestRow) => normalisePaymentRequest(row));
}

export async function listOutgoingPaymentRequests(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
  includeClosed?: boolean;
}): Promise<PaymentRequestRecord[]> {
  let query = options.supabase
    .from("v_payment_requests_v1")
    .select("*")
    .eq("city_slug", options.cityScope.citySlug)
    .eq("request_by", options.userId);

  if (!options.includeClosed) {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load outgoing payment requests: ${error.message}`);
  }

  return (data ?? []).map((row: RequestRow) => normalisePaymentRequest(row));
}

export async function listRecentPaymentRequestParticipants(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
}): Promise<RecentParticipantRecord[]> {
  const [incoming, outgoing] = await Promise.all([
    listIncomingPaymentRequests({
      supabase: options.supabase,
      cityScope: options.cityScope,
      userId: options.userId,
    }),
    listOutgoingPaymentRequests({
      supabase: options.supabase,
      cityScope: options.cityScope,
      userId: options.userId,
      includeClosed: true,
    }),
  ]);

  const participants = new Map<number, RecentParticipantRecord>();
  const toTimestamp = (value: string | null) => {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };

  const upsert = (record: RecentParticipantRecord) => {
    const existing = participants.get(record.id);
    if (!existing || toTimestamp(record.lastInteractionAt) >= toTimestamp(existing.lastInteractionAt)) {
      participants.set(record.id, record);
    }
  };

  incoming.forEach((request) => {
    if (request.requestBy == null) {
      return;
    }
    upsert({
      id: request.requestBy,
      fullName: request.requesterFullName,
      username: request.requesterUsername,
      profileImageUrl: request.requesterProfileImageUrl,
      walletPublicKey: request.requesterWalletPublicKey,
      lastInteractionAt: request.createdAt,
    });
  });

  outgoing.forEach((request) => {
    if (request.requestFrom == null) {
      return;
    }
    upsert({
      id: request.requestFrom,
      fullName: request.recipientFullName,
      username: request.recipientUsername,
      profileImageUrl: request.recipientProfileImageUrl,
      walletPublicKey: request.recipientWalletPublicKey,
      lastInteractionAt: request.createdAt,
    });
  });

  return Array.from(participants.values())
    .sort((left, right) => toTimestamp(right.lastInteractionAt) - toTimestamp(left.lastInteractionAt))
    .slice(0, 12);
}

export async function createPaymentRequest(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  requesterId: number;
  requestFrom: number | null;
  amountRequested: number | null;
}): Promise<PaymentRequestRecord> {
  const amountRequested = assertValidAmount(options.amountRequested);
  const payload = {
    citycoin_id: options.cityScope.citycoinId,
    app_instance_id: options.cityScope.appInstanceId,
    request_by: options.requesterId,
    request_from: options.requestFrom,
    amount_requested: amountRequested,
    status: "pending",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await options.supabase
    .from("invoice_pay_request")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create payment request: ${error.message}`);
  }

  await insertTargetedNotification({
    supabase: options.supabase,
    requesterId: options.requesterId,
    requestFrom: options.requestFrom,
    amountRequested,
  });

  const requestId = normaliseInteger((data as RequestRow | null)?.id);
  if (requestId == null) {
    throw new Error("Payment request was created without an id.");
  }

  const request = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId,
  });

  if (!request) {
    throw new Error("Created payment request could not be reloaded.");
  }

  return request;
}

export async function markPaymentRequestPaid(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
  requestId: number;
  transactionId?: number | null;
}): Promise<PaymentRequestRecord> {
  const request = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });

  if (!request) {
    throw new Error("Payment request not found.");
  }
  if (request.requestFrom !== options.userId) {
    throw new Error("Forbidden: recipient access required.");
  }

  const paidAt = new Date().toISOString();
  const { error } = await options.supabase
    .from("invoice_pay_request")
    .update({
      status: "paid",
      paid_at: paidAt,
      closed_at: paidAt,
      updated_at: paidAt,
      transaction_id: options.transactionId ?? null,
    })
    .eq("id", options.requestId);

  if (error) {
    throw new Error(`Failed to mark payment request paid: ${error.message}`);
  }

  const updated = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });
  if (!updated) {
    throw new Error("Updated payment request could not be reloaded.");
  }
  return updated;
}

export async function dismissPaymentRequest(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
  requestId: number;
}): Promise<PaymentRequestRecord> {
  const request = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });

  if (!request) {
    throw new Error("Payment request not found.");
  }
  if (request.requestFrom !== options.userId) {
    throw new Error("Forbidden: recipient access required.");
  }

  const closedAt = new Date().toISOString();
  const { error } = await options.supabase
    .from("invoice_pay_request")
    .update({
      status: "dismissed",
      closed_at: closedAt,
      updated_at: closedAt,
    })
    .eq("id", options.requestId);

  if (error) {
    throw new Error(`Failed to dismiss payment request: ${error.message}`);
  }

  const updated = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });
  if (!updated) {
    throw new Error("Updated payment request could not be reloaded.");
  }
  return updated;
}

export async function cancelPaymentRequest(options: {
  supabase: any;
  cityScope: EdgeCityScope;
  userId: number;
  requestId: number;
}): Promise<PaymentRequestRecord> {
  const request = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });

  if (!request) {
    throw new Error("Payment request not found.");
  }
  if (request.requestBy !== options.userId) {
    throw new Error("Forbidden: requester access required.");
  }

  const closedAt = new Date().toISOString();
  const { error } = await options.supabase
    .from("invoice_pay_request")
    .update({
      status: "cancelled",
      closed_at: closedAt,
      updated_at: closedAt,
    })
    .eq("id", options.requestId);

  if (error) {
    throw new Error(`Failed to cancel payment request: ${error.message}`);
  }

  const updated = await readPaymentRequestById({
    supabase: options.supabase,
    citySlug: options.cityScope.citySlug,
    requestId: options.requestId,
  });
  if (!updated) {
    throw new Error("Updated payment request could not be reloaded.");
  }
  return updated;
}
