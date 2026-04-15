/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useUserSettingsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const contactsTabPropsMock = vi.hoisted(() => vi.fn());
const sendTabPropsMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(
  () =>
    ({
      get: vi.fn(() => null),
    }) as Pick<URLSearchParams, "get">
);

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<any>, options?: { loading?: () => React.ReactNode }) => {
    const MockDynamicComponent = (props: Record<string, unknown>) => {
      const [LoadedComponent, setLoadedComponent] = React.useState<React.ComponentType<any> | null>(null);

      React.useEffect(() => {
        let cancelled = false;
        void loader().then((mod) => {
          if (!cancelled) {
            setLoadedComponent(() => (mod?.default ?? mod) as React.ComponentType<any>);
          }
        });

        return () => {
          cancelled = true;
        };
      }, []);

      if (!LoadedComponent) {
        return options?.loading ? <>{options.loading()}</> : null;
      }

      return <LoadedComponent {...props} />;
    };

    return MockDynamicComponent;
  },
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

vi.mock("@tcoin/wallet/components/dashboard/WalletHome", () => ({
  WalletHome: ({ onOpenTransactionHistory }: { onOpenTransactionHistory?: () => void }) => (
    <button onClick={() => onOpenTransactionHistory?.()}>open-history</button>
  ),
}));

vi.mock("@tcoin/wallet/components/dashboard/SimpleWalletHome", () => ({
  SimpleWalletHome: () => <div>simple-home</div>,
}));

vi.mock("@tcoin/wallet/components/dashboard/ContactsTab", () => ({
  ContactsTab: (props: any) => {
    contactsTabPropsMock(props);
    return <div>contacts</div>;
  },
}));

vi.mock("@tcoin/wallet/components/dashboard/SendTab", () => ({
  SendTab: (props: any) => {
    sendTabPropsMock(props);
    return <div>send</div>;
  },
}));

vi.mock("@tcoin/wallet/components/dashboard/ReceiveTab", () => ({
  ReceiveTab: () => <div>receive</div>,
}));

vi.mock("@tcoin/wallet/components/dashboard/MoreTab", () => ({
  MoreTab: () => <div>more</div>,
}));

vi.mock("@tcoin/wallet/components/dashboard/TransactionHistoryTab", () => ({
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
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "advanced",
        },
      },
      isLoading: false,
    });
    pushMock.mockReset();
    contactsTabPropsMock.mockReset();
    sendTabPropsMock.mockReset();
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

  it("keeps home content uncapped while narrowing focused task tabs", async () => {
    const { rerender } = render(<DashboardPage />);

    expect(screen.getByTestId("dashboard-tab-content").className).toBe("w-full");

    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "receive" : null));
    rerender(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-tab-content").className).toContain("max-w-[62.5rem]");
      expect(screen.getByText("receive")).toBeTruthy();
    });
  });

  it("renders the simplified home and hides more in simple mode", () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "simple",
        },
      },
      isLoading: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("simple-home")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send money/i })).toBeNull();
  });

  it("redirects simple-mode more requests back to home", () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "simple",
        },
      },
      isLoading: false,
    });
    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "more" : null));

    render(<DashboardPage />);

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("stabilizes the contacts resolver so repeated identical results do not loop", async () => {
    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "contacts" : null));
    render(<DashboardPage />);

    await waitFor(() => {
      expect(contactsTabPropsMock).toHaveBeenCalled();
    });
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

  it("disables the invite empty state in simple-mode contacts", async () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "simple",
        },
      },
      isLoading: false,
    });
    searchParamsMock.get = vi.fn((key: string) => (key === "tab" ? "contacts" : null));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(contactsTabPropsMock).toHaveBeenCalled();
    });
    const props = contactsTabPropsMock.mock.calls.at(-1)?.[0];
    expect(props.showInviteEmptyState).toBe(false);
  });

  it("passes public pay-link query params and pending intents into send", async () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        preferences: {
          experienceMode: "advanced",
        },
        signup: {
          pendingPaymentIntent: {
            recipientUserId: 42,
            recipientName: "Taylor Example",
            recipientUsername: "tay",
            recipientProfileImageUrl: null,
            recipientWalletAddress: "0xwallet",
            recipientUserIdentifier: "taylor-example",
            amountRequested: 13.1,
            sourceToken: "opaque-token",
            sourceMode: "rotating_multi_use",
            createdAt: "2026-04-02T10:00:00.000Z",
          },
        },
      },
      isLoading: false,
    });
    searchParamsMock.get = vi.fn((key: string) => {
      if (key === "tab") return "send";
      if (key === "paymentLink") return "opaque-token";
      if (key === "resumePayment") return "1";
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(sendTabPropsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentLinkToken: "opaque-token",
          resumePendingPayment: true,
          pendingPaymentIntent: expect.objectContaining({
            recipientUserId: 42,
            sourceToken: "opaque-token",
          }),
        })
      );
    });
  });
});
