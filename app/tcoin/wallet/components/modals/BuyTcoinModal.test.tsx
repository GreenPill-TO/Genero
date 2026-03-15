/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastInfoMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const createOnrampSessionMock = vi.hoisted(() => vi.fn());
const updateOnrampSessionMock = vi.hoisted(() => vi.fn());
const getOnrampSessionMock = vi.hoisted(() => vi.fn());
const touchOnrampSessionsMock = vi.hoisted(() => vi.fn());

vi.mock("react-toastify", () => ({
  toast: {
    info: toastInfoMock,
    error: toastErrorMock,
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1, state: "ready", loading: false, error: null }),
}));

vi.mock("@shared/lib/edge/onrampClient", () => ({
  createOnrampSession: createOnrampSessionMock,
  updateOnrampSession: updateOnrampSessionMock,
  getOnrampSession: getOnrampSessionMock,
  touchOnrampSessions: touchOnrampSessionsMock,
}));

import { BuyTcoinModal } from "./BuyTcoinModal";

describe("BuyTcoinModal", () => {
  beforeEach(() => {
    cleanup();
    toastInfoMock.mockReset();
    toastErrorMock.mockReset();
    createOnrampSessionMock.mockReset();
    updateOnrampSessionMock.mockReset();
    getOnrampSessionMock.mockReset();
    touchOnrampSessionsMock.mockReset();
    createOnrampSessionMock.mockResolvedValue({
      state: "ready",
      sessionId: "session-1",
      provider: "transak",
      status: "created",
      depositAddress: "0x2222222222222222222222222222222222222222",
      recipientWallet: "0x1111111111111111111111111111111111111111",
      widgetUrl: "https://global.transak.com",
      widgetConfig: {},
    });
    updateOnrampSessionMock.mockResolvedValue({
      session: {
        id: "session-1",
        status: "widget_opened",
        timeline: [],
      },
    });
    getOnrampSessionMock.mockResolvedValue({
      session: {
        id: "session-1",
        status: "created",
        timeline: [],
      },
    });
    touchOnrampSessionsMock.mockResolvedValue({
      scanned: 1,
      settled: 0,
      manualReview: 0,
      skipped: 0,
    });
  });

  it("creates a checkout session through the edge client", async () => {
    render(<BuyTcoinModal closeModal={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Open Checkout/i }));

    await waitFor(() => {
      expect(createOnrampSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fiatAmount: 100,
          fiatCurrency: "CAD",
          countryCode: "CA",
        }),
        { citySlug: "tcoin" }
      );
    });

    expect(updateOnrampSessionMock).toHaveBeenCalledWith(
      "session-1",
      { action: "widget_opened" },
      { citySlug: "tcoin" }
    );
    expect(toastInfoMock).toHaveBeenCalled();
    expect(screen.getByTitle(/Buy TCOIN checkout/i)).toBeTruthy();
  });

  it("shows a user-facing disabled message when checkout is unavailable", async () => {
    createOnrampSessionMock.mockResolvedValue({
      state: "disabled",
      reason: "feature_disabled",
      message: "Buy TCOIN checkout is currently unavailable.",
    });

    render(<BuyTcoinModal closeModal={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Open Checkout/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Buy TCOIN checkout is currently unavailable.");
    });

    expect(updateOnrampSessionMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Buy TCOIN checkout is currently unavailable\./i).length).toBeGreaterThan(0);
  });

  it("shows a wallet-setup message when checkout needs a wallet", async () => {
    createOnrampSessionMock.mockResolvedValue({
      state: "needs_wallet",
      reason: "wallet_not_ready",
      message: "Finish wallet setup before starting Buy TCOIN checkout.",
    });

    render(<BuyTcoinModal closeModal={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Open Checkout/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Finish wallet setup before starting Buy TCOIN checkout.");
    });

    expect(updateOnrampSessionMock).not.toHaveBeenCalled();
  });
});
