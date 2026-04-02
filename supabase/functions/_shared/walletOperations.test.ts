import { describe, expect, it } from "vitest";
import { __testOnly__, getWalletTransactionHistory } from "./walletOperations";

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
});
