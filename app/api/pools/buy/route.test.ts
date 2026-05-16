/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  proxyEdgeRequestMock: vi.fn(),
}));

vi.mock("@shared/lib/edge/serverProxy", () => ({
  proxyEdgeRequest: h.proxyEdgeRequestMock,
}));

import { POST } from "./route";

describe("POST /api/pools/buy", () => {
  beforeEach(() => {
    h.proxyEdgeRequestMock.mockReset();
    h.proxyEdgeRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("proxies pool purchase requests to the onramp edge function", async () => {
    const req = new Request("http://localhost/api/pools/buy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        citySlug: "tcoin",
        chainId: 42220,
        fiatAmount: 30,
        tokenAmount: 10,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(h.proxyEdgeRequestMock).toHaveBeenCalledWith({
      req,
      functionName: "onramp",
      path: "/pool-purchase-request",
      method: "POST",
      body: {
        citySlug: "tcoin",
        chainId: 42220,
        fiatAmount: 30,
        tokenAmount: 10,
      },
    });
  });

  it("forwards edge errors unchanged", async () => {
    h.proxyEdgeRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "No active BIA affiliation" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );

    const req = new Request("http://localhost/api/pools/buy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fiatAmount: 15,
        tokenAmount: 5,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(String(body.error)).toContain("No active BIA affiliation");
  });
});
