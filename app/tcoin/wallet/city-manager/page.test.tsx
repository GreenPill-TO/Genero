/** @vitest-environment jsdom */
import React from "react";
import { render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useControlPlaneAccessMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/api/hooks/useControlPlaneAccess", () => ({
  useControlPlaneAccess: () => useControlPlaneAccessMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@tcoin/wallet/components/DashboardFooter", () => ({
  DashboardFooter: () => <div data-testid="dashboard-footer" />,
}));

import CityManagerPage from "./page";

describe("CityManagerPage", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      isLoadingUser: false,
      error: null,
    });
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessCityManager: false,
      },
      error: null,
      isLoading: false,
    });
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("redirects users without city-manager API access", async () => {
    render(<CityManagerPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
