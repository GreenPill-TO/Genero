/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ serviceRole: true })));
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const paymentLinkMocks = vi.hoisted(() => ({
  consumePaymentRequestLink: vi.fn(),
  createPaymentRequestLink: vi.fn(),
  resolvePaymentRequestLink: vi.fn(),
}));

vi.mock("../_shared/auth.ts", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
  resolveAuthenticatedEdgeContext: resolveAuthenticatedEdgeContextMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveAppContextInput: vi.fn(() => ({
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: "development",
  })),
}));

vi.mock("../_shared/paymentRequestLinks.ts", () => paymentLinkMocks);

import { handleRequest } from "./index";

describe("payment-links handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedEdgeContextMock.mockResolvedValue({
      scopedClient: {},
      userRow: { id: 42 },
      appContext: {
        appSlug: "wallet",
        citySlug: "tcoin",
        environment: "development",
        appInstanceId: 7,
      },
    });
  });

  it("creates links through scoped identity/context and a route-specific service role", async () => {
    paymentLinkMocks.createPaymentRequestLink.mockResolvedValue({ link: { token: "tok" } });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-links/create", {
        method: "POST",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ amountRequested: 12, mode: "single_use" }),
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeContextMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "payment links scoped identity and app context" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({ purpose: "payment links /create operation" });
    expect(paymentLinkMocks.createPaymentRequestLink).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 42,
        appContext: expect.objectContaining({ appInstanceId: 7 }),
      })
    );
  });
});
