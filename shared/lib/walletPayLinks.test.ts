import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  buildWalletPayUrl,
  decodeLegacyWalletPayPayload,
  extractWalletPayToken,
  resolveWalletPublicBaseUrl,
} from "./walletPayLinks";

describe("walletPayLinks", () => {
  const previousBaseUrl = process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL;
  });

  afterEach(() => {
    if (typeof previousBaseUrl === "string") {
      process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL = previousBaseUrl;
    } else {
      delete process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL;
    }
  });

  it("uses the www tcoin base URL by default", () => {
    expect(resolveWalletPublicBaseUrl()).toBe("https://www.tcoin.me");
    expect(buildWalletPayUrl("opaque token")).toBe("https://www.tcoin.me/pay/opaque%20token");
  });

  it("extracts pay tokens from public wallet URLs", () => {
    expect(extractWalletPayToken("https://www.tcoin.me/pay/opaque-token")).toBe("opaque-token");
  });

  it("decodes legacy pay payloads with UTF-8 characters safely", () => {
    const payload = {
      recipientName: "Montréal Café",
      note: "Paiement demandé",
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

    expect(
      decodeLegacyWalletPayPayload(`https://www.tcoin.me?pay=${encodeURIComponent(encoded)}`)
    ).toEqual(payload);
  });
});
