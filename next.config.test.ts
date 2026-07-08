import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nextConfig = require("./next.config.js");

describe("next.config rewrites", () => {
  it("keeps explicit wallet root aliases for operator and dashboard routes", async () => {
    const rewrites = await nextConfig.rewrites();

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/dashboard",
          destination: "/tcoin/wallet/dashboard",
        },
        {
          source: "/merchant",
          destination: "/tcoin/wallet/merchant",
        },
        {
          source: "/admin",
          destination: "/tcoin/wallet/admin",
        },
        {
          source: "/city-manager",
          destination: "/tcoin/wallet/city-manager",
        },
      ])
    );
  });

  it("keeps the generic non-api fallback rewrite last", async () => {
    const rewrites = await nextConfig.rewrites();
    const lastRewrite = rewrites.at(-1);

    expect(lastRewrite).toEqual({
      source: "/:path((?!api(?:/|$)).*)",
      destination: "/tcoin/wallet/:path*",
    });
  });
});
