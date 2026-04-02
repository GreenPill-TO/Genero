import { describe, expect, it } from "vitest";
import {
  buildFallbackUserIdentifier,
  buildUserIdentifierVariant,
  isFallbackUserIdentifier,
  normaliseEmailAddress,
  normaliseManagedEmails,
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
