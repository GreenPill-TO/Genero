/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(
  () =>
    ({
      get: vi.fn(() => null),
    }) as Pick<URLSearchParams, "get">
);

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("@shared/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@tcoin/wallet/components/DashboardFooter", () => ({
  DashboardFooter: ({ onChange }: { onChange: (value: string) => void }) => (
    <button onClick={() => onChange("home")}>footer-home</button>
  ),
}));

vi.mock("@tcoin/wallet/components/dashboard", () => ({
  WalletHome: ({ onOpenTransactionHistory }: { onOpenTransactionHistory?: () => void }) => (
    <button onClick={() => onOpenTransactionHistory?.()}>open-history</button>
  ),
  ContactsTab: () => <div>contacts</div>,
  SendTab: () => <div>send</div>,
  ReceiveTab: () => <div>receive</div>,
  MoreTab: () => <div>more</div>,
  TransactionHistoryTab: ({ onBackToDashboard }: { onBackToDashboard?: () => void }) => (
    <button onClick={() => onBackToDashboard?.()}>back-home</button>
  ),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          full_name: "Test User",
        },
      },
      error: null,
      isLoadingUser: false,
    });
    pushMock.mockReset();
    searchParamsMock.get = vi.fn(() => null);
  });

  it("pushes the history tab URL when WalletHome opens transaction history", () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByText("open-history"));

    expect(pushMock).toHaveBeenCalledWith("/dashboard?tab=history");
  });
});
