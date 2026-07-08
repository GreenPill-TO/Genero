/** @vitest-environment node */
import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyAndDecodeTransakWebhookPayload } from "./transak";

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("verifyAndDecodeTransakWebhookPayload", () => {
  afterEach(() => {
    delete process.env.ONRAMP_TRANSAK_ACCESS_TOKEN;
    delete process.env.ONRAMP_TRANSAK_WEBHOOK_SECRET;
    delete process.env.ONRAMP_GAS_BANK_PRIVATE_KEY;
    delete process.env.ONRAMP_HD_MASTER_SEED;
  });

  it("verifies webhook JWTs without requiring settlement secrets", () => {
    process.env.ONRAMP_TRANSAK_ACCESS_TOKEN = "webhook-access-token";
    const token = signJwt({ eventType: "ORDER_COMPLETED" }, "webhook-access-token");

    const result = verifyAndDecodeTransakWebhookPayload(JSON.stringify({ jwt: token }), null);

    expect(result).toEqual({
      isValid: true,
      payload: { eventType: "ORDER_COMPLETED" },
      mode: "jwt_access_token",
    });
  });

  it("verifies legacy HMAC signatures without requiring settlement secrets", () => {
    process.env.ONRAMP_TRANSAK_WEBHOOK_SECRET = "legacy-webhook-secret";
    const rawBody = JSON.stringify({ eventType: "ORDER_COMPLETED" });
    const signature = crypto.createHmac("sha256", "legacy-webhook-secret").update(rawBody).digest("hex");

    const result = verifyAndDecodeTransakWebhookPayload(rawBody, `sha256=${signature}`);

    expect(result).toEqual({
      isValid: true,
      payload: { eventType: "ORDER_COMPLETED" },
      mode: "legacy_hmac",
    });
  });
});
