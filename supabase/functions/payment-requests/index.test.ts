/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserMock = vi.hoisted(() => vi.fn());
const resolveActiveAppContextMock = vi.hoisted(() => vi.fn());
const paymentRequestMocks = vi.hoisted(() => ({
  listIncomingPaymentRequests: vi.fn(),
  listOutgoingPaymentRequests: vi.fn(),
  listRecentPaymentRequestParticipants: vi.fn(),
  createPaymentRequest: vi.fn(),
  markPaymentRequestPaid: vi.fn(),
  dismissPaymentRequest: vi.fn(),
  cancelPaymentRequest: vi.fn(),
}));

vi.mock("../_shared/auth.ts", () => ({
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveActiveAppContext: resolveActiveAppContextMock,
  resolveAppContextInput: vi.fn((req: Request, body?: Record<string, unknown> | null) => ({
    appSlug:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).appSlug === "string"
        ? ((body.appContext as Record<string, unknown>).appSlug as string)
        : req.headers.get("x-app-slug")) ?? "wallet",
    citySlug:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).citySlug === "string"
        ? ((body.appContext as Record<string, unknown>).citySlug as string)
        : req.headers.get("x-city-slug")) ?? "tcoin",
    environment:
      (typeof body?.appContext === "object" &&
      body?.appContext &&
      typeof (body.appContext as Record<string, unknown>).environment === "string"
        ? ((body.appContext as Record<string, unknown>).environment as string)
        : req.headers.get("x-app-environment")) ?? "development",
  })),
}));

vi.mock("../_shared/paymentRequests.ts", () => paymentRequestMocks);

import { handleRequest } from "./index";

describe("payment-requests handleRequest", () => {
  const maybeSingleMock = vi.fn();
  const limitMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqMock = vi.fn(() => ({ limit: limitMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  beforeEach(() => {
    vi.clearAllMocks();

    resolveAuthenticatedUserMock.mockResolvedValue({
      serviceRole: {
        from: fromMock,
      },
      userRow: { id: 42 },
    });

    resolveActiveAppContextMock.mockResolvedValue({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });

    maybeSingleMock.mockResolvedValue({
      data: { id: 1, slug: "tcoin" },
      error: null,
    });
  });

  it("returns city-scoped incoming payment requests", async () => {
    paymentRequestMocks.listIncomingPaymentRequests.mockResolvedValue([{ id: 11 }]);

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-requests/incoming?citySlug=tcoin", {
        method: "GET",
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      citySlug: "tcoin",
      requests: [{ id: 11 }],
    });
    expect(paymentRequestMocks.listIncomingPaymentRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        cityScope: expect.objectContaining({ citySlug: "tcoin", citycoinId: 1 }),
      })
    );
  });

  it("creates a targeted payment request", async () => {
    paymentRequestMocks.createPaymentRequest.mockResolvedValue({ id: 12, requestFrom: 99 });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-requests/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app-slug": "wallet",
          "x-city-slug": "tcoin",
          "x-app-environment": "development",
        },
        body: JSON.stringify({
          requestFrom: 99,
          amountRequested: 15,
          appContext: {
            appSlug: "wallet",
            citySlug: "tcoin",
            environment: "development",
          },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(paymentRequestMocks.createPaymentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 42,
        requestFrom: 99,
        amountRequested: 15,
        cityScope: expect.objectContaining({ appInstanceId: 7, citySlug: "tcoin" }),
      })
    );
  });

  it("marks a payment request paid", async () => {
    paymentRequestMocks.markPaymentRequestPaid.mockResolvedValue({ id: 15, status: "paid" });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-requests/mark-paid", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-city-slug": "tcoin",
        },
        body: JSON.stringify({
          requestId: 15,
          transactionId: 77,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(paymentRequestMocks.markPaymentRequestPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        requestId: 15,
        transactionId: 77,
      })
    );
  });

  it("rejects mismatched citySlug and appContext", async () => {
    resolveActiveAppContextMock.mockResolvedValueOnce({
      appSlug: "wallet",
      citySlug: "othercoin",
      environment: "development",
      appInstanceId: 7,
    });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-requests/incoming?citySlug=tcoin", {
        method: "GET",
        headers: {
          "x-city-slug": "othercoin",
        },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "City scope mismatch between citySlug and appContext.",
    });
  });

  it("returns forbidden when the helper enforces recipient ownership", async () => {
    paymentRequestMocks.dismissPaymentRequest.mockRejectedValue(
      new Error("Forbidden: recipient access required.")
    );

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/payment-requests/dismiss", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-city-slug": "tcoin",
        },
        body: JSON.stringify({
          requestId: 18,
        }),
      })
    );

    expect(res.status).toBe(403);
  });
});
