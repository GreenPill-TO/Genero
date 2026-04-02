type WalletOperationsContext = {
  supabase: any;
  userId: number;
  appContext: {
    citySlug: string;
    appInstanceId: number;
  };
};

type WalletIdentityRow = {
  user_id: number;
  public_key: string;
};

type ImportedContactRow = {
  id: number;
  display_name: string | null;
  email: string;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type InviteRecipientInput = {
  email: string;
  displayName: string | null;
  source: string;
};

function toInteger(value: unknown): number | null {
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

function normalizeWallet(value: unknown): string | null {
  const wallet = toStringOrNull(value);
  return wallet ? wallet.toLowerCase() : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = toStringOrNull(value)?.toLowerCase() ?? null;
  if (!email) {
    return null;
  }
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? email : null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function inferInviteSource(sources: string[]): string {
  const unique = Array.from(new Set(sources));
  if (unique.length === 0) {
    return "manual";
  }
  if (unique.length === 1) {
    return unique[0];
  }
  return "mixed";
}

function normalizeImportedContactsInput(value: unknown): InviteRecipientInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, InviteRecipientInput>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const record = item as Record<string, unknown>;
    const email = normalizeEmail(record.email);
    if (!email) {
      return;
    }
    deduped.set(email, {
      email,
      displayName: toStringOrNull(record.displayName),
      source: toStringOrNull(record.source) ?? "browser-contact-picker",
    });
  });

  return Array.from(deduped.values());
}

function normalizeInviteRecipients(value: unknown): InviteRecipientInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, InviteRecipientInput>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const record = item as Record<string, unknown>;
    const email = normalizeEmail(record.email);
    if (!email) {
      return;
    }
    deduped.set(email, {
      email,
      displayName: toStringOrNull(record.displayName),
      source: toStringOrNull(record.source) ?? "manual",
    });
  });

  return Array.from(deduped.values());
}

async function listWalletIdentityRows(options: {
  supabase: any;
  userIds?: number[];
  userId?: number;
}) {
  let query = options.supabase
    .from("v_wallet_identities_v1")
    .select("user_id,public_key")
    .order("user_id", { ascending: true });

  if (typeof options.userId === "number") {
    query = query.eq("user_id", options.userId);
  } else if (options.userIds && options.userIds.length > 0) {
    query = query.in("user_id", options.userIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load wallet identities: ${error.message}`);
  }

  return ((data ?? []) as WalletIdentityRow[])
    .map((row) => ({
      user_id: toInteger(row.user_id) ?? 0,
      public_key: normalizeWallet(row.public_key) ?? "",
    }))
    .filter((row) => row.user_id > 0 && row.public_key);
}

async function listWalletsForUser(options: { supabase: any; userId: number }): Promise<string[]> {
  const rows = await listWalletIdentityRows({ supabase: options.supabase, userId: options.userId });
  return rows.map((row) => row.public_key);
}

async function mapPrimaryWalletsByUserIds(options: {
  supabase: any;
  userIds: number[];
}): Promise<Map<number, string>> {
  const rows = await listWalletIdentityRows({
    supabase: options.supabase,
    userIds: options.userIds,
  });

  const result = new Map<number, string>();
  rows.forEach((row) => {
    if (!result.has(row.user_id)) {
      result.set(row.user_id, row.public_key);
    }
  });
  return result;
}

async function mapUserIdsByWallets(options: {
  supabase: any;
  wallets: string[];
}): Promise<Map<string, number>> {
  const wallets = Array.from(
    new Set(options.wallets.map((value) => normalizeWallet(value)).filter((value): value is string => Boolean(value)))
  );
  if (wallets.length === 0) {
    return new Map();
  }

  const { data, error } = await options.supabase
    .from("v_wallet_identities_v1")
    .select("user_id,public_key")
    .in("public_key", wallets);

  if (error) {
    throw new Error(`Failed to map wallet identities: ${error.message}`);
  }

  const result = new Map<string, number>();
  (data ?? []).forEach((row: any) => {
    const wallet = normalizeWallet(row.public_key);
    const userId = toInteger(row.user_id);
    if (wallet && userId != null && !result.has(wallet)) {
      result.set(wallet, userId);
    }
  });
  return result;
}

async function getUserSummaries(options: { supabase: any; userIds: number[] }) {
  if (options.userIds.length === 0) {
    return new Map<number, any>();
  }

  const { data, error } = await options.supabase
    .from("users")
    .select("id,full_name,username,profile_image_url,bio,country,address,user_identifier")
    .in("id", options.userIds);

  if (error) {
    throw new Error(`Failed to load users: ${error.message}`);
  }

  const result = new Map<number, any>();
  (data ?? []).forEach((row: any) => {
    const id = toInteger(row.id);
    if (id != null) {
      result.set(id, row);
    }
  });
  return result;
}

function toContactRecord(options: {
  userId: number;
  userRow: any;
  walletAddress: string | null;
  state?: string | null;
  lastInteractionAt?: string | null;
}) {
  return {
    id: options.userId,
    fullName: toStringOrNull(options.userRow?.full_name),
    username: toStringOrNull(options.userRow?.username),
    profileImageUrl: toStringOrNull(options.userRow?.profile_image_url),
    walletAddress: options.walletAddress,
    bio: toStringOrNull(options.userRow?.bio),
    country: toStringOrNull(options.userRow?.country),
    address: toStringOrNull(options.userRow?.address),
    state: options.state ?? null,
    lastInteractionAt: options.lastInteractionAt ?? null,
    userIdentifier: toStringOrNull(options.userRow?.user_identifier),
  };
}

export async function listWalletContacts(options: WalletOperationsContext) {
  const { data: connectionRows, error } = await options.supabase
    .from("connections")
    .select("connected_user_id,state,modified_at,created_at")
    .eq("owner_user_id", options.userId)
    .eq("app_instance_id", options.appContext.appInstanceId)
    .order("modified_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load contacts: ${error.message}`);
  }

  const deduped = new Map<number, { state: string | null; lastInteractionAt: string | null }>();
  (connectionRows ?? []).forEach((row: any) => {
    const id = toInteger(row.connected_user_id);
    if (id == null) {
      return;
    }
    const state = toStringOrNull(row.state)?.toLowerCase() ?? null;
    if (state === "rejected") {
      return;
    }
    const candidate = toStringOrNull(row.modified_at) ?? toStringOrNull(row.created_at);
    const existing = deduped.get(id);
    if (!existing || toTimestamp(candidate) >= toTimestamp(existing.lastInteractionAt)) {
      deduped.set(id, {
        state,
        lastInteractionAt: candidate,
      });
    }
  });

  const userIds = Array.from(deduped.keys());
  const [usersById, walletsById] = await Promise.all([
    getUserSummaries({ supabase: options.supabase, userIds }),
    mapPrimaryWalletsByUserIds({ supabase: options.supabase, userIds }),
  ]);

  return {
    contacts: userIds
      .map((userId) => {
        const userRow = usersById.get(userId);
        if (!userRow) {
          return null;
        }
        const connection = deduped.get(userId);
        return toContactRecord({
          userId,
          userRow,
          walletAddress: walletsById.get(userId) ?? null,
          state: connection?.state ?? null,
          lastInteractionAt: connection?.lastInteractionAt ?? null,
        });
      })
      .filter((row): row is ReturnType<typeof toContactRecord> => row != null),
  };
}

export async function connectWalletContact(
  options: WalletOperationsContext & { connectedUserId: number; state?: string }
) {
  const connectedUserId = Math.trunc(options.connectedUserId);
  if (!Number.isFinite(connectedUserId) || connectedUserId <= 0) {
    throw new Error("connectedUserId must be a positive number.");
  }

  const state = toStringOrNull(options.state)?.toLowerCase() ?? "new";
  const nowIso = new Date().toISOString();

  const rows = [
    {
      owner_user_id: options.userId,
      connected_user_id: connectedUserId,
      app_instance_id: options.appContext.appInstanceId,
      state,
      modified_at: nowIso,
    },
    {
      owner_user_id: connectedUserId,
      connected_user_id: options.userId,
      app_instance_id: options.appContext.appInstanceId,
      state,
      modified_at: nowIso,
    },
  ];

  const { error } = await options.supabase.from("connections").upsert(rows, {
    onConflict: "owner_user_id,connected_user_id,app_instance_id",
  });

  if (error) {
    throw new Error(`Failed to connect contact: ${error.message}`);
  }

  return getWalletContactDetail({ ...options, contactId: connectedUserId });
}

export async function updateWalletContactState(
  options: WalletOperationsContext & { connectedUserId: number; state: string }
) {
  const connectedUserId = Math.trunc(options.connectedUserId);
  if (!Number.isFinite(connectedUserId) || connectedUserId <= 0) {
    throw new Error("connectedUserId must be a positive number.");
  }

  const state = toStringOrNull(options.state)?.toLowerCase();
  if (!state) {
    throw new Error("state is required.");
  }

  const nowIso = new Date().toISOString();
  const pairs = [
    { owner_user_id: options.userId, connected_user_id: connectedUserId },
    { owner_user_id: connectedUserId, connected_user_id: options.userId },
  ];

  for (const pair of pairs) {
    const { error } = await options.supabase
      .from("connections")
      .update({ state, modified_at: nowIso })
      .match({
        ...pair,
        app_instance_id: options.appContext.appInstanceId,
      });

    if (error) {
      throw new Error(`Failed to update contact state: ${error.message}`);
    }
  }

  return getWalletContactDetail({ ...options, contactId: connectedUserId });
}

export async function getWalletContactDetail(
  options: WalletOperationsContext & { contactId: number }
) {
  const contactId = Math.trunc(options.contactId);
  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("contactId must be a positive number.");
  }

  const [{ data: connectionRow, error: connectionError }, usersById, walletsById] = await Promise.all([
    options.supabase
      .from("connections")
      .select("state,modified_at,created_at")
      .eq("owner_user_id", options.userId)
      .eq("connected_user_id", contactId)
      .eq("app_instance_id", options.appContext.appInstanceId)
      .limit(1)
      .maybeSingle(),
    getUserSummaries({ supabase: options.supabase, userIds: [contactId] }),
    mapPrimaryWalletsByUserIds({ supabase: options.supabase, userIds: [contactId] }),
  ]);

  if (connectionError) {
    throw new Error(`Failed to load contact state: ${connectionError.message}`);
  }

  const userRow = usersById.get(contactId);
  if (!userRow) {
    return { contact: null };
  }

  return {
    contact: toContactRecord({
      userId: contactId,
      userRow,
      walletAddress: walletsById.get(contactId) ?? null,
      state: toStringOrNull(connectionRow?.state),
      lastInteractionAt: toStringOrNull(connectionRow?.modified_at) ?? toStringOrNull(connectionRow?.created_at),
    }),
  };
}

export async function listWalletContactImports(options: WalletOperationsContext) {
  const [{ data: preferenceRow, error: preferenceError }, { data: contactRows, error: contactsError }] =
    await Promise.all([
      options.supabase
        .from("user_contact_import_preferences")
        .select("granted,source,created_at,updated_at")
        .eq("user_id", options.userId)
        .eq("app_instance_id", options.appContext.appInstanceId)
        .limit(1)
        .maybeSingle(),
      options.supabase
        .from("user_imported_contacts")
        .select("id,display_name,email,source,created_at,updated_at")
        .eq("user_id", options.userId)
        .eq("app_instance_id", options.appContext.appInstanceId)
        .order("display_name", { ascending: true, nullsFirst: false })
        .order("email", { ascending: true }),
    ]);

  if (preferenceError) {
    throw new Error(`Failed to load contact import preference: ${preferenceError.message}`);
  }
  if (contactsError) {
    throw new Error(`Failed to load imported contacts: ${contactsError.message}`);
  }

  return {
    preference: preferenceRow
      ? {
          granted: toBoolean(preferenceRow.granted),
          source: toStringOrNull(preferenceRow.source),
          createdAt: toStringOrNull(preferenceRow.created_at),
          updatedAt: toStringOrNull(preferenceRow.updated_at),
        }
      : null,
    importedContacts: ((contactRows ?? []) as ImportedContactRow[]).map((row) => ({
      id: toInteger(row.id) ?? 0,
      displayName: toStringOrNull(row.display_name),
      email: normalizeEmail(row.email) ?? row.email,
      source: toStringOrNull(row.source),
      createdAt: toStringOrNull(row.created_at),
      updatedAt: toStringOrNull(row.updated_at),
    })),
  };
}

export async function saveWalletContactImports(
  options: WalletOperationsContext & {
    granted: boolean;
    source?: string;
    contacts?: unknown;
  }
) {
  const nowIso = new Date().toISOString();
  const source = toStringOrNull(options.source) ?? "browser-contact-picker";

  const { error: preferenceError } = await options.supabase
    .from("user_contact_import_preferences")
    .upsert(
      {
        user_id: options.userId,
        app_instance_id: options.appContext.appInstanceId,
        granted: options.granted,
        source,
        updated_at: nowIso,
      },
      {
        onConflict: "user_id,app_instance_id",
      }
    );

  if (preferenceError) {
    throw new Error(`Failed to save contact import preference: ${preferenceError.message}`);
  }

  const importedContacts = normalizeImportedContactsInput(options.contacts);
  if (importedContacts.length > 0) {
    const { error: contactsError } = await options.supabase
      .from("user_imported_contacts")
      .upsert(
        importedContacts.map((contact) => ({
          user_id: options.userId,
          app_instance_id: options.appContext.appInstanceId,
          display_name: contact.displayName,
          email: contact.email,
          source: contact.source,
          updated_at: nowIso,
        })),
        {
          onConflict: "user_id,app_instance_id,email",
        }
      );

    if (contactsError) {
      throw new Error(`Failed to save imported contacts: ${contactsError.message}`);
    }
  }

  return listWalletContactImports(options);
}

export async function queueWalletContactInviteBatch(
  options: WalletOperationsContext & {
    subject: string;
    message: string;
    recipients?: unknown;
  }
) {
  const subject = toStringOrNull(options.subject);
  if (!subject) {
    throw new Error("subject is required.");
  }

  const message = toStringOrNull(options.message);
  if (!message) {
    throw new Error("message is required.");
  }

  const recipients = normalizeInviteRecipients(options.recipients);
  if (recipients.length === 0) {
    throw new Error("At least one invite recipient is required.");
  }

  const source = inferInviteSource(recipients.map((recipient) => recipient.source));
  const nowIso = new Date().toISOString();

  const { data: batchRow, error: batchError } = await options.supabase
    .from("contact_invite_batches")
    .insert({
      user_id: options.userId,
      app_instance_id: options.appContext.appInstanceId,
      source,
      subject,
      message,
      status: "queued",
      updated_at: nowIso,
    })
    .select("id,source,status,subject,message,created_at")
    .single();

  if (batchError) {
    throw new Error(`Failed to queue invite batch: ${batchError.message}`);
  }

  const batchId = toInteger(batchRow?.id);
  if (batchId == null) {
    throw new Error("Invite batch did not return an id.");
  }

  const { error: recipientsError } = await options.supabase
    .from("contact_invite_batch_recipients")
    .insert(
      recipients.map((recipient) => ({
        batch_id: batchId,
        email: recipient.email,
        display_name: recipient.displayName,
        source: recipient.source,
      }))
    );

  if (recipientsError) {
    await options.supabase.from("contact_invite_batches").delete().eq("id", batchId);
    throw new Error(`Failed to queue invite recipients: ${recipientsError.message}`);
  }

  return {
    batch: {
      id: batchId,
      source: toStringOrNull(batchRow?.source) ?? source,
      status: toStringOrNull(batchRow?.status) ?? "queued",
      subject: toStringOrNull(batchRow?.subject) ?? subject,
      message: toStringOrNull(batchRow?.message) ?? message,
      recipientCount: recipients.length,
      createdAt: toStringOrNull(batchRow?.created_at),
    },
  };
}

async function listTransactionRowsForWallets(options: {
  supabase: any;
  wallets: string[];
  column: "wallet_account_to" | "wallet_account_from";
  limit: number;
}) {
  if (options.wallets.length === 0) {
    return [];
  }

  const { data, error } = await options.supabase
    .from("act_transaction_entries")
    .select("id,amount,currency,wallet_account_from,wallet_account_to,created_at")
    .eq("currency", "TCOIN")
    .in(options.column, options.wallets)
    .order("created_at", { ascending: false })
    .limit(options.limit);

  if (error) {
    throw new Error(`Failed to load transaction entries: ${error.message}`);
  }

  return data ?? [];
}

function buildTransactionHistory(rows: any[], myWalletSet: Set<string>) {
  const deduped = new Map<number, any>();

  rows.forEach((row: any) => {
    const id = toInteger(row.id);
    if (id == null) {
      return;
    }

    const createdAt = toStringOrNull(row.created_at);
    const previous = deduped.get(id);
    if (!previous || toTimestamp(createdAt) > toTimestamp(previous.created_at)) {
      deduped.set(id, {
        id,
        amount: toNumber(row.amount),
        currency: toStringOrNull(row.currency) ?? "TCOIN",
        wallet_account_from: normalizeWallet(row.wallet_account_from),
        wallet_account_to: normalizeWallet(row.wallet_account_to),
        created_at: createdAt,
      });
    }
  });

  return Array.from(deduped.values())
    .map((row) => {
      const fromIsMine = row.wallet_account_from ? myWalletSet.has(row.wallet_account_from) : false;
      const toIsMine = row.wallet_account_to ? myWalletSet.has(row.wallet_account_to) : false;
      const direction =
        fromIsMine && toIsMine ? "internal" : fromIsMine ? "sent" : "received";
      const counterpartyWallet =
        direction === "sent"
          ? row.wallet_account_to
          : direction === "received"
            ? row.wallet_account_from
            : row.wallet_account_to ?? row.wallet_account_from;

      return {
        id: row.id,
        amount: row.amount,
        currency: row.currency,
        walletFrom: row.wallet_account_from,
        walletTo: row.wallet_account_to,
        createdAt: row.created_at,
        direction,
        counterpartyWallet,
      };
    })
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
}

export async function getWalletTransactionHistory(options: WalletOperationsContext) {
  const myWallets = await listWalletsForUser({ supabase: options.supabase, userId: options.userId });
  if (myWallets.length === 0) {
    return { transactions: [] };
  }

  const [toRows, fromRows] = await Promise.all([
    listTransactionRowsForWallets({
      supabase: options.supabase,
      wallets: myWallets,
      column: "wallet_account_to",
      limit: 120,
    }),
    listTransactionRowsForWallets({
      supabase: options.supabase,
      wallets: myWallets,
      column: "wallet_account_from",
      limit: 120,
    }),
  ]);

  return {
    transactions: buildTransactionHistory([...toRows, ...fromRows], new Set(myWallets)),
  };
}

export async function getWalletContactTransactionHistory(
  options: WalletOperationsContext & { contactId: number }
) {
  const contactId = Math.trunc(options.contactId);
  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("contactId must be a positive number.");
  }

  const [myWallets, contactWallets] = await Promise.all([
    listWalletsForUser({ supabase: options.supabase, userId: options.userId }),
    listWalletsForUser({ supabase: options.supabase, userId: contactId }),
  ]);

  if (myWallets.length === 0 || contactWallets.length === 0) {
    return { transactions: [] };
  }

  const [sentRows, receivedRows] = await Promise.all([
    options.supabase
      .from("act_transaction_entries")
      .select("id,amount,currency,wallet_account_from,wallet_account_to,created_at")
      .eq("currency", "TCOIN")
      .in("wallet_account_from", myWallets)
      .in("wallet_account_to", contactWallets)
      .order("created_at", { ascending: false })
      .limit(100),
    options.supabase
      .from("act_transaction_entries")
      .select("id,amount,currency,wallet_account_from,wallet_account_to,created_at")
      .eq("currency", "TCOIN")
      .in("wallet_account_from", contactWallets)
      .in("wallet_account_to", myWallets)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (sentRows.error) {
    throw new Error(`Failed to load sent contact transactions: ${sentRows.error.message}`);
  }
  if (receivedRows.error) {
    throw new Error(`Failed to load received contact transactions: ${receivedRows.error.message}`);
  }

  return {
    transactions: buildTransactionHistory(
      [...(sentRows.data ?? []), ...(receivedRows.data ?? [])],
      new Set(myWallets)
    ).filter((row) => {
      const otherWallet = row.counterpartyWallet;
      return otherWallet ? contactWallets.includes(otherWallet) : false;
    }),
  };
}

export async function listWalletRecents(options: WalletOperationsContext) {
  const recentsByUser = new Map<number, ReturnType<typeof toContactRecord>>();

  const contacts = await listWalletContacts(options);
  contacts.contacts.forEach((contact) => {
    recentsByUser.set(contact.id, contact);
  });

  const myWallets = await listWalletsForUser({ supabase: options.supabase, userId: options.userId });
  if (myWallets.length > 0) {
    const [toRows, fromRows] = await Promise.all([
      listTransactionRowsForWallets({
        supabase: options.supabase,
        wallets: myWallets,
        column: "wallet_account_to",
        limit: 80,
      }),
      listTransactionRowsForWallets({
        supabase: options.supabase,
        wallets: myWallets,
        column: "wallet_account_from",
        limit: 80,
      }),
    ]);

    const myWalletSet = new Set(myWallets);
    const walletLastSeen = new Map<string, string>();

    [...toRows, ...fromRows].forEach((row: any) => {
      const createdAt = toStringOrNull(row.created_at);
      if (!createdAt) {
        return;
      }
      const fromWallet = normalizeWallet(row.wallet_account_from);
      const toWallet = normalizeWallet(row.wallet_account_to);
      const counterpartWallet =
        toWallet && myWalletSet.has(toWallet)
          ? fromWallet
          : fromWallet && myWalletSet.has(fromWallet)
            ? toWallet
            : null;
      if (!counterpartWallet || myWalletSet.has(counterpartWallet)) {
        return;
      }
      const existing = walletLastSeen.get(counterpartWallet);
      if (!existing || toTimestamp(createdAt) > toTimestamp(existing)) {
        walletLastSeen.set(counterpartWallet, createdAt);
      }
    });

    const walletToUserId = await mapUserIdsByWallets({
      supabase: options.supabase,
      wallets: Array.from(walletLastSeen.keys()),
    });
    const userIds = Array.from(new Set(Array.from(walletToUserId.values())));
    const [usersById, walletsById] = await Promise.all([
      getUserSummaries({ supabase: options.supabase, userIds }),
      mapPrimaryWalletsByUserIds({ supabase: options.supabase, userIds }),
    ]);

    walletLastSeen.forEach((lastInteractionAt, wallet) => {
      const userId = walletToUserId.get(wallet);
      if (!userId || userId === options.userId) {
        return;
      }
      const userRow = usersById.get(userId);
      if (!userRow) {
        return;
      }
      const next = toContactRecord({
        userId,
        userRow,
        walletAddress: walletsById.get(userId) ?? null,
        lastInteractionAt,
      });
      const existing = recentsByUser.get(userId);
      if (!existing || toTimestamp(next.lastInteractionAt) >= toTimestamp(existing.lastInteractionAt)) {
        recentsByUser.set(userId, next);
      }
    });
  }

  return {
    participants: Array.from(recentsByUser.values())
      .filter((row) => row.id !== options.userId)
      .sort((left, right) => toTimestamp(right.lastInteractionAt) - toTimestamp(left.lastInteractionAt))
      .slice(0, 12),
  };
}

export async function lookupWalletUserByIdentifier(
  options: WalletOperationsContext & { userIdentifier: string }
) {
  const userIdentifier = toStringOrNull(options.userIdentifier);
  if (!userIdentifier) {
    throw new Error("userIdentifier is required.");
  }

  const { data, error } = await options.supabase
    .from("users")
    .select("id,full_name,username,profile_image_url,bio,country,address,user_identifier")
    .eq("user_identifier", userIdentifier)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up user: ${error.message}`);
  }

  const userId = toInteger(data?.id);
  if (userId == null) {
    return { user: null };
  }

  const walletsById = await mapPrimaryWalletsByUserIds({
    supabase: options.supabase,
    userIds: [userId],
  });

  return {
    user: toContactRecord({
      userId,
      userRow: data,
      walletAddress: walletsById.get(userId) ?? null,
    }),
  };
}

export async function recordWalletTransfer(
  options: WalletOperationsContext & {
    recipient_wallet: string;
    sender_wallet: string;
    token_price?: number;
    transfer_amount: number;
    transfer_user_id: number;
  }
) {
  const { data, error } = await options.supabase.rpc("simple_transfer", {
    recipient_wallet: options.recipient_wallet,
    sender_wallet: options.sender_wallet,
    token_price: options.token_price ?? 3.3,
    transfer_amount: options.transfer_amount,
    transfer_user_id: options.transfer_user_id,
  });

  if (error) {
    throw new Error(`Failed to record transfer: ${error.message}`);
  }

  return { record: data ?? null };
}

export async function sendWalletSuccessNotification(
  options: WalletOperationsContext & {
    userIdOverride: string | number;
    notification: string;
    additionalData?: Record<string, unknown>;
  }
) {
  const userId = toInteger(options.userIdOverride);
  if (userId == null) {
    throw new Error("user_id is required.");
  }

  const { error } = await options.supabase.from("notifications").insert({
    user_id: userId,
    notification: options.notification,
    ...(options.additionalData ?? {}),
  });

  if (error) {
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  return { ok: true };
}

export async function sendWalletAdminNotification(
  options: WalletOperationsContext & {
    userIdOverride: string;
    notification: string;
  }
) {
  const { error } = await options.supabase.from("app_admin_notifications").insert({
    user_id: options.userIdOverride,
    notification_name: options.notification,
  });

  if (error) {
    throw new Error(`Failed to insert admin notification: ${error.message}`);
  }

  return { ok: true };
}
