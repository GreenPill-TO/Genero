import { describe, expect, it } from "vitest";
import { userHasAnyRole } from "./rbac";

describe("userHasAnyRole", () => {
  it("returns true when a scoped role exists", async () => {
    const hasRole = await userHasAnyRole({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              in: () => ({
                eq: async () => ({
                  data: [{ role: "admin" }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      },
      userId: 1,
      roles: ["admin"],
      appInstanceId: 7,
    });

    expect(hasRole).toBe(true);
  });

  it("returns false when no matching role exists", async () => {
    const hasRole = await userHasAnyRole({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      },
      userId: 1,
      roles: ["admin"],
    });

    expect(hasRole).toBe(false);
  });
});
