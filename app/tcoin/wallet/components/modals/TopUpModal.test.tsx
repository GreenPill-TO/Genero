/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TopUpModal } from "./TopUpModal";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createLegacyInteracReferenceMock = vi.hoisted(() => vi.fn());
const confirmLegacyInteracReferenceMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: {
      cubidData: {
        id: 123,
      },
    },
  }),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({
    exchangeRate: null,
    state: "setup_required",
    loading: false,
    error: null,
  }),
}));

vi.mock("@shared/lib/edge/onrampClient", () => ({
  createLegacyInteracReference: (...args: any[]) => createLegacyInteracReferenceMock(...args),
  confirmLegacyInteracReference: (...args: any[]) => confirmLegacyInteracReferenceMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

describe("TopUpModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createLegacyInteracReferenceMock.mockResolvedValue({ transfer: { id: 1 } });
    confirmLegacyInteracReferenceMock.mockResolvedValue({
      transfer: { id: 1 },
      transaction: { id: 2 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders", () => {
    const closeModal = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TopUpModal closeModal={closeModal} />
      </QueryClientProvider>
    );
  });

  it("falls back to the token amount when exchange rate is unavailable", () => {
    const closeModal = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TopUpModal closeModal={closeModal} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/enter amount of tcoin/i), {
      target: { value: "10" },
    });

    expect(screen.getByText("10 CAD")).toBeTruthy();
  });

  it("shows a toast instead of throwing when legacy Interac setup is unavailable", async () => {
    createLegacyInteracReferenceMock.mockRejectedValue(
      new Error("onramp route /legacy/interac/reference is not available in this environment.")
    );
    const closeModal = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TopUpModal closeModal={closeModal} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/enter amount of tcoin/i), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "onramp route /legacy/interac/reference is not available in this environment."
      );
    });
    expect(screen.queryByText(/confirm top up/i)).toBeNull();
  });
});
