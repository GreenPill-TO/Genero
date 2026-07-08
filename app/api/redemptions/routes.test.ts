/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const proxyEdgeRequestMock = vi.hoisted(() =>
  vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
);

vi.mock("@shared/lib/edge/serverProxy", () => ({
  proxyEdgeRequest: proxyEdgeRequestMock,
}));

import { POST as requestPOST } from "./request/route";
import { GET as listGET } from "./list/route";
import { POST as approvePOST } from "./[id]/approve/route";
import { POST as settlePOST } from "./[id]/settle/route";

describe("/api/redemptions/* proxy routes", () => {
  it("proxies request creation", async () => {
    const req = new Request("http://localhost/api/redemptions/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ citySlug: "tcoin", storeId: 9 }),
    });
    const res = await requestPOST(req);
    expect(res.status).toBe(200);
    expect(proxyEdgeRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "redemptions",
      path: "/request",
    }));
  });

  it("proxies list reads", async () => {
    const req = new Request("http://localhost/api/redemptions/list?citySlug=tcoin&status=pending");
    const res = await listGET(req);
    expect(res.status).toBe(200);
    expect(proxyEdgeRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "redemptions",
      path: "/list?citySlug=tcoin&status=pending",
    }));
  });

  it("proxies approval writes", async () => {
    const req = new Request("http://localhost/api/redemptions/req-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ citySlug: "tcoin", approve: true }),
    });
    const res = await approvePOST(req, { params: { id: "req-1" } });
    expect(res.status).toBe(200);
    expect(proxyEdgeRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "redemptions",
      path: "/req-1/approve",
    }));
  });

  it("proxies settlement writes", async () => {
    const req = new Request("http://localhost/api/redemptions/req-1/settle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ citySlug: "tcoin", settlementAmount: 10 }),
    });
    const res = await settlePOST(req, { params: { id: "req-1" } });
    expect(res.status).toBe(200);
    expect(proxyEdgeRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "redemptions",
      path: "/req-1/settle",
    }));
  });
});
