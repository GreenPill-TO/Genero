import { describe, expect, it } from "vitest";
import { resolveActiveAppContext } from "./appContext";

function createQuery(result: unknown) {
  const query: Record<string, any> = {
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => result,
  };
  query.then = undefined;
  return query;
}

describe("resolveActiveAppContext", () => {
  it("resolves an exact app instance when environment is provided", async () => {
    const context = await resolveActiveAppContext({
      supabase: {
        from: () => ({
          select: () =>
            createQuery({
              data: { id: 7 },
              error: null,
            }),
        }),
      },
      input: {
        appSlug: "wallet",
        citySlug: "tcoin",
        environment: "development",
      },
    });

    expect(context).toEqual({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
  });

  it("rejects ambiguous app instances when environment is omitted", async () => {
    await expect(
      resolveActiveAppContext({
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({
                    data: [{ id: 1, environment: "development" }, { id: 2, environment: "production" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        },
        input: {
          appSlug: "wallet",
          citySlug: "tcoin",
          environment: "",
        },
      })
    ).rejects.toThrow("Specify environment explicitly");
  });
});
