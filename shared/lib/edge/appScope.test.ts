import { afterEach, describe, expect, it } from "vitest";
import { resolveAppScope } from "./appScope";

const originalAppName = process.env.NEXT_PUBLIC_APP_NAME;
const originalCityCoin = process.env.NEXT_PUBLIC_CITYCOIN;
const originalEnvironment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT;

describe("resolveAppScope", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_NAME = originalAppName;
    process.env.NEXT_PUBLIC_CITYCOIN = originalCityCoin;
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = originalEnvironment;
  });

  it("uses explicit overrides when provided", () => {
    expect(
      resolveAppScope({
        appSlug: "Wallet",
        citySlug: "TCOIN",
        environment: "Development",
      })
    ).toEqual({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
    });
  });

  it("falls back to repository defaults when no overrides are provided", () => {
    expect(resolveAppScope()).toEqual({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "",
    });
  });
});
