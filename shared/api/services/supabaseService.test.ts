import { beforeEach, describe, expect, it, vi } from "vitest";

const walletOperationsState = vi.hoisted(() => ({
  contacts: [] as Array<{
    id: number;
    fullName: string | null;
    username: string | null;
    profileImageUrl: string | null;
    walletAddress: string | null;
    state: string | null;
    lastInteractionAt: string | null;
  }>,
  error: null as { message: string } | null,
  calls: 0,
}));

vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  getWalletContacts: vi.fn(async () => {
    walletOperationsState.calls += 1;
    if (walletOperationsState.error) {
      throw walletOperationsState.error;
    }

    return {
      contacts: walletOperationsState.contacts,
    };
  }),
}));

import {
  fetchContactsForOwner,
  normaliseCredentialId,
  normaliseDeviceInfo,
  serialiseUserShare,
} from "./supabaseService";

describe("fetchContactsForOwner", () => {
  beforeEach(() => {
    walletOperationsState.contacts = [];
    walletOperationsState.error = null;
    walletOperationsState.calls = 0;
  });

  it("returns an empty array when the owner id is invalid", async () => {
    const result = await fetchContactsForOwner(null);
    expect(result).toEqual([]);
    expect(walletOperationsState.calls).toBe(0);
  });

  it("maps edge contact rows to contact records", async () => {
    walletOperationsState.contacts = [
      {
        id: 7,
        fullName: "Test User",
        username: "test",
        profileImageUrl: "avatar.png",
        walletAddress: "0xabc",
        state: "accepted",
        lastInteractionAt: "2024-01-02T00:00:00.000Z",
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([
      {
        id: 7,
        full_name: "Test User",
        username: "test",
        profile_image_url: "avatar.png",
        wallet_address: "0xabc",
        state: "accepted",
        last_interaction: "2024-01-02T00:00:00.000Z",
      },
    ]);
    expect(walletOperationsState.calls).toBe(1);
  });

  it("preserves duplicate contact rows from the edge response as-is", async () => {
    walletOperationsState.contacts = [
      {
        id: 8,
        fullName: "Duplicate",
        username: null,
        profileImageUrl: null,
        walletAddress: null,
        state: "accepted",
        lastInteractionAt: "2024-01-03T00:00:00.000Z",
      },
      {
        id: 8,
        fullName: "Duplicate",
        username: null,
        profileImageUrl: null,
        walletAddress: null,
        state: "new",
        lastInteractionAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 8,
      state: "accepted",
      last_interaction: "2024-01-03T00:00:00.000Z",
    });
    expect(result[1]).toMatchObject({
      id: 8,
      state: "new",
      last_interaction: "2024-01-01T00:00:00.000Z",
    });
  });

  it("maps multiple contacts with their edge-provided wallet addresses", async () => {
    walletOperationsState.contacts = [
      {
        id: 14,
        fullName: "Shared Key",
        username: "shared",
        profileImageUrl: null,
        walletAddress: "0xshared-primary",
        state: "accepted",
        lastInteractionAt: "2024-01-05T00:00:00.000Z",
      },
      {
        id: 15,
        fullName: "Second Key",
        username: "secondary",
        profileImageUrl: null,
        walletAddress: "0xshared-secondary",
        state: "accepted",
        lastInteractionAt: "2024-01-06T00:00:00.000Z",
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: 14,
        wallet_address: "0xshared-primary",
      }),
      expect.objectContaining({
        id: 15,
        wallet_address: "0xshared-secondary",
      }),
    ]);
  });

  it("returns an empty array when the edge response has no contacts", async () => {
    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([]);
  });

  it("preserves rejected contacts when the edge response includes them", async () => {
    walletOperationsState.contacts = [
      {
        id: 11,
        fullName: "Rejected",
        username: null,
        profileImageUrl: null,
        walletAddress: null,
        state: "rejected",
        lastInteractionAt: null,
      },
      {
        id: 12,
        fullName: "Allowed",
        username: null,
        profileImageUrl: null,
        walletAddress: null,
        state: "accepted",
        lastInteractionAt: "2024-01-04T00:00:00.000Z",
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: 11,
        state: "rejected",
      }),
      expect.objectContaining({
        id: 12,
        state: "accepted",
        last_interaction: "2024-01-04T00:00:00.000Z",
      }),
    ]);
  });

  it("throws when the edge contact fetch fails", async () => {
    walletOperationsState.error = { message: "boom" };
    await expect(fetchContactsForOwner(1)).rejects.toEqual({ message: "boom" });
  });
});

describe("wallet credential helpers", () => {
  it("serialises Cubid user shares and exposes a decoded credential id", () => {
    const textEncoder = new TextEncoder();
    const share = serialiseUserShare({
      encryptedAesKey: textEncoder.encode("aes").buffer,
      encryptedData: textEncoder.encode("data").buffer,
      encryptionMethod: "aes-gcm",
      id: "share-1",
      iv: textEncoder.encode("iv").buffer,
      ivForKeyEncryption: "key-iv",
      salt: "salt",
      credentialId: textEncoder.encode("cred-1").buffer,
    });

    expect(share.userShareEncrypted.credentialId).toBe("Y3JlZC0x");
    expect(share.credentialId).toBe("637265642d31");
  });

  it("normalises credential ids and device info payloads", () => {
    expect(normaliseCredentialId("  ABCD  ")).toBe("abcd");
    expect(normaliseCredentialId("   ")).toBeNull();

    expect(
      normaliseDeviceInfo({
        userAgent: " Test UA ",
        platform: " web ",
        label: " Pixel 9 ",
      })
    ).toEqual({ userAgent: "Test UA", platform: "web", label: "Pixel 9" });
    expect(normaliseDeviceInfo({ userAgent: "", platform: null, label: "  " })).toBeNull();
  });
});
