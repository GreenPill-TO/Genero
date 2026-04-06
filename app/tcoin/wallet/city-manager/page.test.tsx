/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useControlPlaneAccessMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const getCityManagerStoresMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/api/hooks/useControlPlaneAccess", () => ({
  useControlPlaneAccess: () => useControlPlaneAccessMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

vi.mock("@tcoin/wallet/components/DashboardFooter", () => ({
  DashboardFooter: () => <div data-testid="dashboard-footer" />,
}));

vi.mock("@shared/lib/edge/storeOperationsClient", () => ({
  getCityManagerStores: (...args: unknown[]) => getCityManagerStoresMock(...args),
  approveCityManagerStore: vi.fn(),
  rejectCityManagerStore: vi.fn(),
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
    getCityManagerStoresMock.mockResolvedValue({ stores: [] });
    replaceMock.mockReset();
    pushMock.mockReset();
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

  it("uses the shared dashboard shell and footer", async () => {
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessCityManager: true,
      },
      error: null,
      isLoading: false,
    });

    const { container } = render(<CityManagerPage />);

    await waitFor(() => {
      expect(screen.getByText(/City Manager/i)).toBeTruthy();
    });

    expect((container.firstChild as HTMLElement).className).toContain("lg:pl-[9.5rem]");
    expect((container.firstChild as HTMLElement).className).toContain("xl:pl-[10.5rem]");
    expect(screen.getByTestId("dashboard-footer")).toBeTruthy();
  });

  it("opens applicant details with the requested profile fields", async () => {
    getCityManagerStoresMock.mockResolvedValue({
      stores: [
        {
          storeId: 22,
          appInstanceId: 1,
          lifecycleStatus: "pending",
          signupStep: 5,
          signupProgressCount: 5,
          createdAt: "2026-03-01T00:00:00.000Z",
          submittedAt: "2026-03-10T00:00:00.000Z",
          approvedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          applicant: {
            userId: 9,
            fullName: "Jamie Doe",
            username: "jamiedoe",
            email: "jamie@example.com",
            phone: "+1 416 555 0101",
            country: "Canada",
            address: "123 Queen St W, Toronto, ON",
            profileImageUrl: "https://example.com/jamie.png",
            createdAt: "2025-04-02T12:00:00.000Z",
          },
          profile: {
            displayName: "Jamie's Bakery",
            slug: "jamies-bakery",
            description: null,
            logoUrl: null,
            bannerUrl: null,
            addressText: "123 Queen St W, Toronto, ON",
            lat: null,
            lng: null,
            walletAddress: null,
            status: null,
          },
          bia: {
            id: "bia-1",
            code: "KW",
            name: "King West",
          },
        },
      ],
    });
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessCityManager: true,
      },
      error: null,
      isLoading: false,
    });

    render(<CityManagerPage />);

    const applicantButton = await screen.findByRole("button", { name: /Jamie Doe/i });
    fireEvent.click(applicantButton);

    expect(await screen.findByText(/Applicant profile/i)).toBeTruthy();

    const dialog = screen.getByRole("dialog");
    const dialogScope = within(dialog);

    expect(dialogScope.getByText(/jamie@example.com/i)).toBeTruthy();
    expect(dialogScope.getByText(/@jamiedoe/i)).toBeTruthy();
    expect(dialogScope.getByText(/\+1 416 555 0101/i)).toBeTruthy();
    expect(dialogScope.getByText(/123 Queen St W, Toronto, ON/i)).toBeTruthy();
    expect(dialogScope.getByText(/Canada/i)).toBeTruthy();
    expect(dialogScope.getByText(/Joined Apr 2, 2025/i)).toBeTruthy();
  });
});
