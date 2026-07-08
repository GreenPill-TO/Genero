/** @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionHistoryTab } from "./TransactionHistoryTab";

const getWalletTransactionHistoryMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  getWalletTransactionHistory: (...args: unknown[]) => getWalletTransactionHistoryMock(...args),
}));

describe("TransactionHistoryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          id: 1,
        },
      },
    });
  });

  it("renders transaction rows from the canonical transactions response shape", async () => {
    getWalletTransactionHistoryMock.mockResolvedValue({
      transactions: [
        {
          id: 17,
          amount: 42.5,
          currency: "TCOIN",
          walletFrom: "sender-wallet-123456",
          walletTo: "recipient-wallet-654321",
          createdAt: "2026-04-02T17:00:00.000Z",
          direction: "received",
          counterpartyWallet: "sender-wallet-123456",
        },
      ],
    });

    render(<TransactionHistoryTab onBackToDashboard={() => {}} />);

    expect(await screen.findByText("Received")).toBeTruthy();
    expect(screen.getByText(/Counterparty: sender/i)).toBeTruthy();
    expect(screen.getByText(/\+42\.50 TCOIN/i)).toBeTruthy();
  });

  it("shows an empty state when the history endpoint returns no transactions", async () => {
    getWalletTransactionHistoryMock.mockResolvedValue({ transactions: [] });

    render(<TransactionHistoryTab onBackToDashboard={() => {}} />);

    await waitFor(() => expect(screen.getByText(/No transactions found yet\./i)).toBeTruthy());
  });
});
