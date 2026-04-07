/** @vitest-environment jsdom */
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockGetUserSettingsBootstrap = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  __esModule: true,
  useAuth: mockUseAuth,
}));

vi.mock("@shared/lib/userSettings/client", () => ({
  __esModule: true,
  getUserSettingsBootstrap: mockGetUserSettingsBootstrap,
}));

import { useUserSettings } from "./useUserSettings";

describe("useUserSettings", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockUseAuth.mockReset();
    mockGetUserSettingsBootstrap.mockReset();
    mockGetUserSettingsBootstrap.mockResolvedValue({
      user: { id: 1 },
      preferences: { theme: "system" },
    });
  });

  it("does not bootstrap user settings while auth is still provisioning the user record", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingUser: true,
      userData: null,
    });

    const { result } = renderHook(() => useUserSettings(), { wrapper });

    expect(mockGetUserSettingsBootstrap).not.toHaveBeenCalled();
    expect(result.current.bootstrap).toBeNull();
  });

  it("does not bootstrap user settings until an authenticated user record exists", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingUser: false,
      userData: { user: null, cubidData: null },
    });

    const { result } = renderHook(() => useUserSettings(), { wrapper });

    expect(mockGetUserSettingsBootstrap).not.toHaveBeenCalled();
    expect(result.current.bootstrap).toBeNull();
  });

  it("bootstraps user settings once auth has resolved the user record", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingUser: false,
      userData: {
        user: { id: 1 },
        cubidData: { id: 1 },
      },
    });

    const { result } = renderHook(() => useUserSettings(), { wrapper });

    await waitFor(() => {
      expect(mockGetUserSettingsBootstrap).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.bootstrap).toEqual({
        user: { id: 1 },
        preferences: { theme: "system" },
      });
    });
  });
});
