/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());

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

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("./screens/WalletScreen", () => ({
  WalletScreen: () => <div data-testid="sparechange-wallet-screen">wallet-screen</div>,
}));

import DashboardPage from "./page";

describe("SpareChange dashboard page", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          activeProfile: {
            persona: "wallet",
          },
        },
      },
      error: null,
      isLoadingUser: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the auth loading state while user data is loading", () => {
    useAuthMock.mockReturnValue({
      userData: null,
      error: null,
      isLoadingUser: true,
    });

    render(<DashboardPage />);

    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });

  it("shows the auth error when profile loading fails", () => {
    useAuthMock.mockReturnValue({
      userData: null,
      error: { message: "boom" },
      isLoadingUser: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText(/Error loading data: boom/i)).toBeTruthy();
  });

  it("renders the wallet screen for the default persona", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sparechange-wallet-screen")).toBeTruthy();
    });
  });
});
