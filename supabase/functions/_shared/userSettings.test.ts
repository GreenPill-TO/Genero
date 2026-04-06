import { describe, expect, it } from "vitest";
import {
  buildFallbackUserIdentifier,
  buildUserIdentifierVariant,
  ensureAppProfile,
  getLatestWalletListRow,
  isFallbackUserIdentifier,
  normaliseExperienceMode,
  normaliseEmailAddress,
  normaliseManagedEmails,
  normalisePendingPaymentIntent,
  normalisePersistedCubidId,
  normaliseUserIdentifierCandidate,
} from "./userSettings";

describe("user identifier helpers", () => {
  it("normalises preferred identifiers into the allowed shareable format", () => {
    expect(normaliseUserIdentifierCandidate("Taylor Example")).toBe("taylor-example");
    expect(normaliseUserIdentifierCandidate("___Taylor...Example___")).toBe("taylor-example");
  });

  it("returns null when the candidate is too short after normalisation", () => {
    expect(normaliseUserIdentifierCandidate("a")).toBeNull();
    expect(normaliseUserIdentifierCandidate("!!")).toBeNull();
  });

  it("builds a deterministic fallback identifier from the user id", () => {
    expect(buildFallbackUserIdentifier(42)).toBe("user-42");
    expect(isFallbackUserIdentifier("user-42", 42)).toBe(true);
    expect(isFallbackUserIdentifier("custom-42", 42)).toBe(false);
  });

  it("appends suffixes while keeping the identifier inside the 32-character limit", () => {
    expect(buildUserIdentifierVariant("taylor-example", 0)).toBe("taylor-example");
    expect(buildUserIdentifierVariant("taylor-example", 2)).toBe("taylor-example-2");
    expect(buildUserIdentifierVariant("abcdefghijklmnopqrstuvwxyzabcdef", 9)).toBe(
      "abcdefghijklmnopqrstuvwxyzabcd-9"
    );
  });
});

describe("managed email helpers", () => {
  it("normalises email addresses to trimmed lowercase values", () => {
    expect(normaliseEmailAddress("  Taylor.Example@Example.com ")).toBe("taylor.example@example.com");
    expect(normaliseEmailAddress("not-an-email")).toBeNull();
  });

  it("auto-selects the only email as primary", () => {
    expect(normaliseManagedEmails([{ email: "Taylor.Example@Example.com", isPrimary: false }])).toEqual([
      {
        email: "taylor.example@example.com",
        isPrimary: true,
      },
    ]);
  });

  it("dedupes duplicate emails and keeps exactly one explicit primary in multi-email mode", () => {
    expect(
      normaliseManagedEmails([
        { email: "alpha@example.com", isPrimary: false },
        { email: "ALPHA@example.com", isPrimary: false },
        { email: "beta@example.com", isPrimary: true },
      ])
    ).toEqual([
      {
        email: "alpha@example.com",
        isPrimary: false,
      },
      {
        email: "beta@example.com",
        isPrimary: true,
      },
    ]);
  });

  it("rejects multi-email payloads without exactly one primary email", () => {
    expect(() =>
      normaliseManagedEmails([
        { email: "alpha@example.com", isPrimary: false },
        { email: "beta@example.com", isPrimary: false },
      ])
    ).toThrow(/exactly one primary/i);
  });
});

describe("experience mode helpers", () => {
  it("defaults missing or invalid values to simple mode", () => {
    expect(normaliseExperienceMode(undefined)).toBe("simple");
    expect(normaliseExperienceMode(null)).toBe("simple");
    expect(normaliseExperienceMode("unexpected")).toBe("simple");
  });

  it("keeps advanced when it is explicitly selected", () => {
    expect(normaliseExperienceMode("advanced")).toBe("advanced");
  });
});

describe("persisted Cubid id helper", () => {
  it("prefers an explicitly provided Cubid id", () => {
    expect(normalisePersistedCubidId("cubid-seed-1", "auth-user-id")).toBe("cubid-seed-1");
  });

  it("treats a missing Cubid id as null", () => {
    expect(normalisePersistedCubidId(null, "1a2f5397-bd59-4b76-8928-26c13b2a0dfa")).toBeNull();
  });

  it("strips app-derived Cubid ids that only mirror auth_user_id", () => {
    expect(normalisePersistedCubidId("1a2f5397-bd59-4b76-8928-26c13b2a0dfa", "1a2f5397-bd59-4b76-8928-26c13b2a0dfa")).toBeNull();
  });
});

describe("legacy Cubid payload mapping freshness", () => {
  it("preserves created and updated timestamps from bootstrap user data", async () => {
    const { getLegacyCubidData } = await import("./userSettings");

    const query = {
      eq() {
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle: async () => ({
        data: {
          id: 77,
          cubid_id: "auth-user-77",
          auth_user_id: "auth-user-77",
          user_identifier: "user-77",
          email: "person@example.com",
          phone: null,
          full_name: "Person Example",
          nickname: null,
          username: null,
          country: "CA",
          address: null,
          profile_image_url: null,
          has_completed_intro: false,
          is_new_user: true,
          created_at: "2026-04-05T20:00:00.000Z",
          updated_at: "2026-04-05T20:05:00.000Z",
        },
        error: null,
      }),
      order() {
        return query;
      },
      select() {
        return query;
      },
      is() {
        return query;
      },
    };

    const supabase = {
      from() {
        return query;
      },
    };

    const result = await getLegacyCubidData({
      supabase,
      userId: 77,
      appContext: {
        appSlug: "wallet-tcoin-development",
        citySlug: "tcoin",
        environment: "development",
        appInstanceId: 1,
      },
    });

    expect(result.cubid_id).toBeNull();
    expect(result.created_at).toBe("2026-04-05T20:00:00.000Z");
    expect(result.updated_at).toBe("2026-04-05T20:05:00.000Z");
  });
});

describe("app profile helpers", () => {
  it("re-reads the app profile when a concurrent insert hits the composite primary key", async () => {
    let selectCount = 0;
    const selectQuery = {
      eq() {
        return selectQuery;
      },
      limit() {
        return selectQuery;
      },
      maybeSingle: async () => {
        selectCount += 1;
        if (selectCount === 1) {
          return { data: null, error: null };
        }

        return {
          data: {
            user_id: 42,
            app_instance_id: 11,
            charity_preferences: null,
            onboarding_state: null,
            metadata: {},
          },
          error: null,
        };
      },
      select() {
        return selectQuery;
      },
    };

    const insertQuery = {
      select() {
        return insertQuery;
      },
      single: async () => ({
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint "app_user_profiles_pkey"',
        },
      }),
    };

    const supabase = {
      from(table: string) {
        if (table !== "app_user_profiles") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          insert() {
            return insertQuery;
          },
          select() {
            return selectQuery;
          },
        };
      },
    };

    await expect(
      ensureAppProfile({
        supabase,
        userId: 42,
        appInstanceId: 11,
      })
    ).resolves.toEqual({
      user_id: 42,
      app_instance_id: 11,
      charity_preferences: null,
      onboarding_state: null,
      metadata: {},
    });
  });
});

describe("pending payment intent helpers", () => {
  it("normalises valid pending payment intents", () => {
    expect(
      normalisePendingPaymentIntent({
        recipientUserId: "42",
        recipientName: "Taylor Example",
        recipientUsername: "tay",
        recipientProfileImageUrl: "https://example.com/avatar.png",
        recipientWalletAddress: "0xwallet",
        recipientUserIdentifier: "taylor-example",
        amountRequested: "13.1",
        sourceToken: "opaque-token",
        sourceMode: "rotating_multi_use",
        createdAt: "2026-04-02T12:00:00.000Z",
      })
    ).toEqual({
      recipientUserId: 42,
      recipientName: "Taylor Example",
      recipientUsername: "tay",
      recipientProfileImageUrl: "https://example.com/avatar.png",
      recipientWalletAddress: "0xwallet",
      recipientUserIdentifier: "taylor-example",
      amountRequested: 13.1,
      sourceToken: "opaque-token",
      sourceMode: "rotating_multi_use",
      createdAt: "2026-04-02T12:00:00.000Z",
    });
  });

  it("rejects pending payment intents without a recipient user id", () => {
    expect(normalisePendingPaymentIntent({ recipientName: "Taylor Example" })).toBeNull();
    expect(normalisePendingPaymentIntent(null)).toBeNull();
  });
});

describe("wallet list helpers", () => {
  it("resolves the latest wallet row using the identity id column instead of a created_at timestamp", async () => {
    const operations: Array<[string, unknown, unknown?]> = [];
    const query = {
      select(value: string) {
        operations.push(["select", value]);
        return query;
      },
      eq(column: string, value: unknown) {
        operations.push(["eq", column, value]);
        return query;
      },
      order(column: string, options: unknown) {
        operations.push(["order", column, options]);
        return query;
      },
      limit(value: number) {
        operations.push(["limit", value]);
        return query;
      },
      maybeSingle: async () => ({ data: { id: 99 }, error: null }),
    };

    const supabase = {
      from(table: string) {
        operations.push(["from", table]);
        return query;
      },
    };

    const result = await getLatestWalletListRow<{ id: number }>({
      supabase,
      userId: 42,
      select: "id",
      namespace: "EVM",
    });

    expect(result).toEqual({ data: { id: 99 }, error: null });
    expect(operations).toEqual([
      ["from", "wallet_list"],
      ["select", "id"],
      ["eq", "user_id", 42],
      ["eq", "namespace", "EVM"],
      ["order", "id", { ascending: false }],
      ["limit", 1],
    ]);
  });
});
