/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const proxyEdgeRequestMock = vi.hoisted(() => vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));

vi.mock("@shared/lib/edge/serverProxy", () => ({
  proxyEdgeRequest: proxyEdgeRequestMock,
}));

import { POST } from "./route";

describe("POST /api/onramp/session", () => {
  it("proxies the session creation request to the onramp edge function", async () => {
    const req = new Request("http://localhost/api/onramp/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ citySlug: "tcoin", fiatAmount: 120, fiatCurrency: "CAD" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(proxyEdgeRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "onramp",
        path: "/session",
        method: "POST",
      })
    );
  });
});
