import { describe, expect, it } from "vitest";
import { __testOnly__, getWalletTransactionHistory, recordWalletTransfer } from "./walletOperations";

describe("walletOperations transaction ledger handling", () => {
  it("detects the missing local legacy transaction ledger error", () => {
    expect(
      __testOnly__.isMissingLegacyTransactionLedgerError({
        message: "Could not find the table 'public.act_transaction_entries' in the schema cache",
      })
    ).toBe(true);
    expect(
      __testOnly__.isMissingLegacyTransactionLedgerError({
        message: 'relation "public.act_transaction_entries" does not exist',
      })
    ).toBe(true);
    expect(
      __testOnly__.isMissingLegacyTransactionLedgerError({
        message: "other database error",
      })
    ).toBe(false);
  });

  it("returns an empty transaction history when the legacy ledger is unavailable", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: async () => ({
        data: null,
        error: {
          message: "Could not find the table 'public.act_transaction_entries' in the schema cache",
        },
      }),
    };

    const supabase = {
      from: (table: string) => {
        if (table === "v_wallet_identities_v1") {
          const identitiesQuery = {
            eq: () =>
              Promise.resolve({
                data: [{ user_id: 1, public_key: "wallet-a" }],
                error: null,
              }),
            in: () =>
              Promise.resolve({
                data: [{ user_id: 1, public_key: "wallet-a" }],
                error: null,
              }),
          };

          return {
            select: () => ({
              order: () => identitiesQuery,
            }),
          };
        }

        if (table === "wallet_list") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  order: () => ({
                    data: [{ public_key: "wallet-a" }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "act_transaction_entries") {
          return query;
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    };

    await expect(
      getWalletTransactionHistory({
        supabase,
        userId: 1,
        appContext: { citySlug: "tcoin", appInstanceId: 1 },
      })
    ).resolves.toEqual({ transactions: [] });
  });

  it("rejects transfer bookkeeping when the requested user id does not match the authenticated user", async () => {
    await expect(
      recordWalletTransfer({
        supabase: {
          rpc: async () => {
            throw new Error("rpc should not be called");
          },
        },
        userId: 42,
        appContext: { citySlug: "tcoin", appInstanceId: 1 },
        recipient_wallet: "wallet-b",
        sender_wallet: "wallet-a",
        transfer_amount: 10,
        transfer_user_id: 7,
      })
    ).rejects.toThrow("transfer_user_id must match the authenticated user.");
  });

  it("records transfers against the authenticated user id", async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

    await expect(
      recordWalletTransfer({
        supabase: {
          rpc: async (fn: string, args: Record<string, unknown>) => {
            rpcCalls.push({ fn, args });
            return { data: { id: 99 }, error: null };
          },
        },
        userId: 42,
        appContext: { citySlug: "tcoin", appInstanceId: 1 },
        recipient_wallet: "wallet-b",
        sender_wallet: "wallet-a",
        transfer_amount: 10,
        transfer_user_id: 42,
      })
    ).resolves.toEqual({ record: { id: 99 } });

    expect(rpcCalls).toEqual([
      {
        fn: "simple_transfer",
        args: expect.objectContaining({
          transfer_user_id: 42,
          transfer_amount: 10,
          sender_wallet: "wallet-a",
          recipient_wallet: "wallet-b",
        }),
      },
    ]);
  });
});
