import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWalletPayUrl, resolveWalletPublicBaseUrl } from "./paymentRequestLinks.ts";

describe("payment request link public URL", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses WALLET_PUBLIC_BASE_URL before the public fallback and preserves dev.tcoin.me", () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) =>
          key === "WALLET_PUBLIC_BASE_URL"
            ? " https://dev.tcoin.me/ "
            : key === "NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL"
              ? "https://ignored.example"
              : undefined,
      },
    });

    expect(resolveWalletPublicBaseUrl()).toBe("https://dev.tcoin.me");
    expect(buildWalletPayUrl("same/token")).toBe("https://dev.tcoin.me/pay/same%2Ftoken");
  });

  it("uses NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL only when the Edge value is absent", () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) =>
          key === "NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL" ? "https://preview.example/" : undefined,
      },
    });
    expect(buildWalletPayUrl("abc")).toBe("https://preview.example/pay/abc");
  });
});
