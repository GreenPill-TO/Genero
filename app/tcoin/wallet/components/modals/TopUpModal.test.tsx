/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TopUpModal } from "./TopUpModal";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  }),
}));

describe("TopUpModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
