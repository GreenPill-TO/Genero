/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const contactsTabPropsMock = vi.hoisted(() => vi.fn());
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
  ContactsTab: (props: any) => {
    contactsTabPropsMock(props);
    return <div>contacts</div>;
  },
  SendTab: () => <div>send</div>,
  ReceiveTab: () => <div>receive</div>,
  MoreTab: () => <div>more</div>,
  TransactionHistoryTab: ({ onBackToDashboard }: { onBackToDashboard?: () => void }) => (
    <button onClick={() => onBackToDashboard?.()}>back-home</button>
  ),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          full_name: "Test User",
        },
      },
      isAuthenticated: true,
      error: null,
      isLoadingUser: false,
    });
    pushMock.mockReset();
    contactsTabPropsMock.mockReset();
    searchParamsMock.get = vi.fn(() => null);
  });

  it("pushes the history tab URL when WalletHome opens transaction history", () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByText("open-history"));

    expect(pushMock).toHaveBeenCalledWith("/dashboard?tab=history");
  });

  it("shows the signed-out preview instead of wallet tabs when unauthenticated", () => {
    useAuthMock.mockReturnValue({
      userData: null,
      isAuthenticated: false,
      error: null,
      isLoadingUser: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Open your wallet when you're ready")).toBeTruthy();
    expect(screen.queryByText("open-history")).toBeNull();
  });

  it("keeps home content uncapped while narrowing focused task tabs", () => {
    const { rerender } = render(<DashboardPage />);

    expect(screen.getByTestId("dashboard-tab-content").className).toBe("w-full");

    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "receive" : null));
    rerender(<DashboardPage />);

    expect(screen.getByTestId("dashboard-tab-content").className).toContain("max-w-[62.5rem]");
    expect(screen.getByText("receive")).toBeTruthy();
  });

  it("stabilizes the contacts resolver so repeated identical results do not loop", () => {
    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "contacts" : null));
    render(<DashboardPage />);

    const firstProps = contactsTabPropsMock.mock.calls.at(-1)?.[0];
    const resolveContacts = firstProps.onContactsResolved as ((records: any[]) => void) | undefined;
    expect(typeof resolveContacts).toBe("function");

    const records = [
      {
        id: 11,
        full_name: "Alice",
        username: "alice",
        profile_image_url: null,
        wallet_address: "0x1111",
        state: "accepted",
        last_interaction: "2024-01-02T00:00:00.000Z",
      },
    ];

    act(() => {
      resolveContacts?.(records);
    });
    expect(contactsTabPropsMock).toHaveBeenCalledTimes(2);

    act(() => {
      resolveContacts?.([{ ...records[0] }]);
    });
    expect(contactsTabPropsMock).toHaveBeenCalledTimes(2);
  });
});
