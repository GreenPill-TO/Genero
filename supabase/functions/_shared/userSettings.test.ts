import { describe, expect, it } from "vitest";
import {
  buildFallbackUserIdentifier,
  buildUserIdentifierVariant,
  getLatestWalletListRow,
  isFallbackUserIdentifier,
  normaliseExperienceMode,
  normaliseEmailAddress,
  normaliseManagedEmails,
  normalisePendingPaymentIntent,
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
