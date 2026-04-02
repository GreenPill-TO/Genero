/** @vitest-environment jsdom */
import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOutgoingPaymentRequestsMock = vi.hoisted(() =>
  vi.fn(async () => ({
    citySlug: "tcoin",
    requests: [
      {
        id: 5,
        amountRequested: 9,
        requestFrom: 77,
        requestBy: 42,
        status: "pending",
        isOpen: true,
        isActive: true,
        createdAt: "2026-03-15T00:00:00.000Z",
      },
    ],
  }))
);
const createPaymentRequestMock = vi.hoisted(() =>
  vi.fn(async () => ({
    request: {
      id: 6,
      amountRequested: 3,
      requestFrom: null,
      requestBy: 42,
      status: "pending",
      isOpen: true,
      isActive: true,
      createdAt: "2026-03-15T01:00:00.000Z",
    },
  }))
);
const cancelPaymentRequestMock = vi.hoisted(() => vi.fn(async () => ({ request: { id: 5 } })));
const createPaymentRequestLinkMock = vi.hoisted(() =>
  vi.fn(async () => ({
    link: {
      token: "opaque-token",
      state: "ready",
      mode: "rotating_multi_use",
      amountRequested: null,
      expiresAt: "2026-04-02T12:00:00.000Z",
      consumedAt: null,
      url: "https://www.tcoin.me/pay/opaque-token",
      recipient: {
        id: 42,
        fullName: "Hubert",
        username: "hubert",
        profileImageUrl: null,
        walletAddress: "0xabc",
        userIdentifier: "hubert",
      },
    },
  }))
);
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/edge/paymentRequestsClient", () => ({
  getOutgoingPaymentRequests: getOutgoingPaymentRequestsMock,
  createPaymentRequest: createPaymentRequestMock,
  cancelPaymentRequest: cancelPaymentRequestMock,
}));

vi.mock("@shared/lib/edge/paymentRequestLinksClient", () => ({
  createPaymentRequestLink: createPaymentRequestLinkMock,
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 2, state: "ready", error: null, loading: false }),
}));

let receiveCardProps: any;
vi.mock("./ReceiveCard", () => ({
  ReceiveCard: (props: any) => {
    receiveCardProps = props;
    return <div data-testid="receive-card" />;
  },
}));

import { ReceiveTab } from "./ReceiveTab";

describe("ReceiveTab", () => {
  beforeEach(() => {
    receiveCardProps = undefined;
    getOutgoingPaymentRequestsMock.mockClear();
    createPaymentRequestMock.mockClear();
    cancelPaymentRequestMock.mockClear();
    createPaymentRequestLinkMock.mockClear();
    useAuthMock.mockReturnValue({
      isLoadingUser: false,
      authData: { user: { id: "auth-user-1" } },
      userData: {
        cubidData: {
          id: 42,
          wallet_address: "0xabc",
          full_name: "Hubert",
        },
      },
    });
  });

  afterEach(() => {
    receiveCardProps = undefined;
  });

  it("loads outgoing requests through the payment-requests edge client", async () => {
    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getOutgoingPaymentRequestsMock).toHaveBeenCalledWith({
      appContext: { citySlug: "tcoin" },
    });
    expect(receiveCardProps.openRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 5,
          amountRequested: 9,
          requestFrom: 77,
        }),
      ])
    );
  });

  it("creates shareable and targeted requests through the edge client", async () => {
    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await receiveCardProps.onCreateShareableRequest(3);
    });

    expect(createPaymentRequestMock).toHaveBeenCalledWith({
      requestFrom: null,
      amountRequested: 3,
      appContext: { citySlug: "tcoin" },
    });

    await act(async () => {
      await receiveCardProps.onCreateTargetedRequest({ id: 77 }, 4, "4.00 TCOIN");
    });

    expect(createPaymentRequestMock).toHaveBeenLastCalledWith({
      requestFrom: 77,
      amountRequested: 4,
      appContext: { citySlug: "tcoin" },
    });
  });

  it("cancels a request through the edge client", async () => {
    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await receiveCardProps.onDeleteRequest(5);
    });

    expect(cancelPaymentRequestMock).toHaveBeenCalledWith({
      requestId: 5,
      appContext: { citySlug: "tcoin" },
    });
  });

  it("generates public pay links for the QR code", async () => {
    useAuthMock.mockReturnValue({
      isLoadingUser: false,
      userData: {
        cubidData: {
          id: 42,
          wallet_address: "0xabc",
          full_name: "Hubert",
        },
      },
      authData: { user: { id: "auth-user-1" } },
    });

    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(createPaymentRequestLinkMock).toHaveBeenCalledWith({
      amountRequested: null,
      mode: "rotating_multi_use",
      appContext: { citySlug: "tcoin" },
    });
    expect(receiveCardProps.qrCodeData).toBe("https://www.tcoin.me/pay/opaque-token");
    expect(receiveCardProps.qrUnavailableReason).toBeNull();
  });

  it("surfaces an unavailable message when there is no wallet session yet", async () => {
    useAuthMock.mockReturnValue({
      isLoadingUser: false,
      userData: {
        cubidData: {
          id: 42,
          wallet_address: "0xabc",
          full_name: "Hubert",
        },
      },
      authData: null,
    });

    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(receiveCardProps.qrCodeData).toBe("");
    expect(receiveCardProps.qrUnavailableReason).toBeNull();
  });

  it("surfaces a loading message while the authenticated user record is still resolving", async () => {
    useAuthMock.mockReturnValue({
      isLoadingUser: true,
      userData: null,
      authData: null,
    });

    render(<ReceiveTab />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(receiveCardProps.qrCodeData).toBe("");
    expect(receiveCardProps.qrUnavailableReason).toBe(
      "QR code is still loading your wallet session."
    );
  });
});
