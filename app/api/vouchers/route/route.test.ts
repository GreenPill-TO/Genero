/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  proxyEdgeRequestMock: vi.fn(),
}));

vi.mock("@shared/lib/edge/serverProxy", () => ({
  proxyEdgeRequest: h.proxyEdgeRequestMock,
}));

import { GET } from "./route";

describe("GET /api/vouchers/route", () => {
  beforeEach(() => {
    h.proxyEdgeRequestMock.mockReset();
    h.proxyEdgeRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ quote: { mode: "voucher" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("proxies voucher route reads to the voucher-runtime edge function", async () => {
    const req = new Request(
      "http://localhost/api/vouchers/route?citySlug=tcoin&amount=10&recipientWallet=0x1111111111111111111111111111111111111111"
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(h.proxyEdgeRequestMock).toHaveBeenCalledWith({
      req,
      functionName: "voucher-runtime",
      path: "/route?amount=10&recipientWallet=0x1111111111111111111111111111111111111111",
      method: "GET",
    });
  });

  it("forwards voucher-runtime validation errors unchanged", async () => {
    h.proxyEdgeRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "recipientWallet is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(new Request("http://localhost/api/vouchers/route?amount=10"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(String(body.error)).toContain("recipientWallet");
  });
});
