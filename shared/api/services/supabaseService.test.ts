import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  connections: [] as Array<{
    connected_user_id: unknown;
    state: string | null;
    modified_at?: string | null;
    created_at?: string | null;
  }>,
  connectionsError: null as { message: string } | null,
  users: [] as Array<{
    id: unknown;
    full_name: string | null;
    username: string | null;
    profile_image_url: string | null;
  }>,
  usersError: null as { message: string } | null,
  walletList: [] as Array<{ user_id: unknown; public_key: string | null }>,
  walletListError: null as { message: string } | null,
  connectionsCalls: 0,
  usersCalls: 0,
  walletListCalls: 0,
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "connections") {
        return {
          select: () => ({
            eq: () => {
              supabaseState.connectionsCalls += 1;
              return Promise.resolve({
                data: supabaseState.connections,
                error: supabaseState.connectionsError,
              });
            },
          }),
        };
      }

      if (table === "users") {
        return {
          select: () => ({
            in: () => {
              supabaseState.usersCalls += 1;
              return Promise.resolve({
                data: supabaseState.users,
                error: supabaseState.usersError,
              });
            },
          }),
        };
      }

      if (table === "wallet_list") {
        return {
          select: () => ({
            in: () => {
              supabaseState.walletListCalls += 1;
              return Promise.resolve({
                data: supabaseState.walletList,
                error: supabaseState.walletListError,
              });
            },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { fetchContactsForOwner } from "./supabaseService";

describe("fetchContactsForOwner", () => {
  beforeEach(() => {
    supabaseState.connections = [];
    supabaseState.connectionsError = null;
    supabaseState.users = [];
    supabaseState.usersError = null;
    supabaseState.walletList = [];
    supabaseState.walletListError = null;
    supabaseState.connectionsCalls = 0;
    supabaseState.usersCalls = 0;
    supabaseState.walletListCalls = 0;
  });

  it("returns an empty array when the owner id is invalid", async () => {
    const result = await fetchContactsForOwner(null);
    expect(result).toEqual([]);
    expect(supabaseState.connectionsCalls).toBe(0);
    expect(supabaseState.usersCalls).toBe(0);
  });

  it("maps connection rows to contact records", async () => {
    supabaseState.connections = [
      {
        connected_user_id: 7,
        state: "accepted",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
    ];
    supabaseState.users = [
      {
        id: 7,
        full_name: "Test User",
        username: "test",
        profile_image_url: "avatar.png",
      },
    ];
    supabaseState.walletList = [
      {
        user_id: 7,
        public_key: "0xabc",
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
    expect(supabaseState.connectionsCalls).toBe(1);
    expect(supabaseState.usersCalls).toBe(1);
    expect(supabaseState.walletListCalls).toBe(1);
  });

  it("deduplicates multiple rows for the same contact", async () => {
    supabaseState.connections = [
      {
        connected_user_id: "8",
        state: "accepted",
        modified_at: "2024-01-03T00:00:00.000Z",
      },
      { connected_user_id: "8", state: "NEW", created_at: "2024-01-01T00:00:00.000Z" },
    ];
    supabaseState.users = [
      {
        id: 8,
        full_name: "Duplicate",
        username: null,
        profile_image_url: null,
      },
    ];
    supabaseState.walletList = [
      {
        user_id: 8,
        public_key: null,
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 8,
      state: "accepted",
      last_interaction: "2024-01-03T00:00:00.000Z",
    });
  });

  it("filters out connections without a corresponding user row", async () => {
    supabaseState.connections = [
      { connected_user_id: 9, state: "accepted", modified_at: null },
    ];
    supabaseState.users = [];
    supabaseState.walletList = [];

    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([]);
  });

  it("ignores rejected connections", async () => {
    supabaseState.connections = [
      { connected_user_id: 11, state: " rejected " },
      { connected_user_id: 12, state: "ACCEPTED", modified_at: "2024-01-04T00:00:00.000Z" },
    ];
    supabaseState.users = [
      {
        id: 12,
        full_name: "Allowed",
        username: null,
        profile_image_url: null,
      },
    ];
    supabaseState.walletList = [
      {
        user_id: 12,
        public_key: null,
      },
    ];

    const result = await fetchContactsForOwner(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: 12,
        state: "accepted",
        last_interaction: "2024-01-04T00:00:00.000Z",
      }),
    ]);
  });

  it("throws when fetching connections fails", async () => {
    supabaseState.connectionsError = { message: "boom" };
    await expect(fetchContactsForOwner(1)).rejects.toEqual({ message: "boom" });
  });

  it("throws when fetching user profiles fails", async () => {
    supabaseState.connections = [
      { connected_user_id: 10, state: "accepted" },
    ];
    supabaseState.usersError = { message: "nope" };

    await expect(fetchContactsForOwner(1)).rejects.toEqual({ message: "nope" });
  });

  it("throws when fetching wallet rows fails", async () => {
    supabaseState.connections = [
      { connected_user_id: 13, state: "accepted" },
    ];
    supabaseState.users = [
      {
        id: 13,
        full_name: "Wallet User",
        username: null,
        profile_image_url: null,
      },
    ];
    supabaseState.walletListError = { message: "wallets down" };

    await expect(fetchContactsForOwner(1)).rejects.toEqual({ message: "wallets down" });
  });
});
