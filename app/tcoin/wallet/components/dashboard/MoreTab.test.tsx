/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openModal = vi.fn();
const closeModal = vi.fn();

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal }),
}));

const createProfile = (overrides: Partial<any> = {}) => ({
  appInstanceId: 1,
  slug: "wallet-tcoin-development",
  persona: null,
  tippingPreferences: {
    preferredDonationAmount: 0,
    goodTip: null,
    defaultTip: null,
  },
  charityPreferences: {
    charity: "Food Bank",
    selectedCause: "Food Bank",
  },
  onboardingState: {
    currentStep: 1,
    category: "Restaurant",
    style: null,
  },
  metadata: null,
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

const useAuthMock = vi.hoisted(() =>
  vi.fn(() => ({
    userData: {
      cubidData: {
        is_admin: false,
        activeProfile: createProfile(),
      },
    },
  }))
);
const useControlPlaneAccessMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: {
      canAccessAdminDashboard: false,
      canAccessCityManager: false,
    },
  }))
);
const getMerchantApplicationStatusMock = vi.hoisted(() => vi.fn(async () => ({ state: "none" })));
const updateVoucherPreferencesMock = vi.hoisted(() => vi.fn(async () => ({ preference: {} })));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/api/hooks/useControlPlaneAccess", () => ({
  useControlPlaneAccess: () => useControlPlaneAccessMock(),
}));
vi.mock("@shared/lib/edge/merchantApplicationsClient", () => ({
  getMerchantApplicationStatus: getMerchantApplicationStatusMock,
}));
vi.mock("@shared/lib/edge/voucherPreferencesClient", () => ({
  updateVoucherPreferences: updateVoucherPreferencesMock,
}));
vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    bootstrap: {
      preferences: {
        charity: "Food Bank",
        selectedCause: "Food Bank",
        theme: "system",
        primaryBiaId: "1",
        secondaryBiaIds: [],
      },
      options: {
        charities: [{ id: "1", name: "Food Bank", value: "Food Bank" }],
        bias: [{ id: "1", code: "DTA", name: "Downtown" }],
      },
    },
  }),
}));

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
  BuyTcoinModal: ({ closeModal }: any) => (
    <button data-testid="buytcoin-modal" onClick={closeModal}>
      buytcoin
    </button>
  ),
  TopUpModal: ({ closeModal }: any) => (
    <button data-testid="topup-modal" onClick={closeModal}>
      topup
    </button>
  ),
  OffRampModal: ({ closeModal }: any) => (
    <button data-testid="offramp-modal" onClick={closeModal}>
      offramp
    </button>
  ),
  CharitySelectModal: () => (
    <button
      data-testid="charity-select"
    >
      select
    </button>
  ),
  CharityContributionsModal: ({ onChangeCharity }: any) => (
    <button data-testid="charity-summary" onClick={onChangeCharity}>
      change
    </button>
  ),
  BiaPreferencesModal: () => <div data-testid="bia-preferences-modal" />,
  VoucherRoutingPreferencesModal: () => <div data-testid="voucher-routing-preferences-modal" />,
  ThemeSelectModal: () => <div data-testid="theme-modal" />,
  FutureAppFeaturesModal: () => <div data-testid="future-features-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/UserProfileModal", () => ({
  UserProfileModal: () => <div data-testid="profile-modal" />,
}));

import { MoreTab } from "./MoreTab";

describe("MoreTab", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          is_admin: false,
          activeProfile: createProfile(),
        },
      },
    });
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessAdminDashboard: false,
        canAccessCityManager: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    pushMock.mockReset();
    getMerchantApplicationStatusMock.mockReset();
    getMerchantApplicationStatusMock.mockResolvedValue({ state: "none" });
    updateVoucherPreferencesMock.mockReset();
    updateVoucherPreferencesMock.mockResolvedValue({ preference: {} });
  });

  it("does not render buy/top-up actions in the More tab", () => {
    render(<MoreTab />);
    expect(screen.queryByRole("button", { name: /Buy TCOIN/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Top Up with Interac eTransfer/i })).toBeNull();
  });

  it("opens history from the More tab overflow action", () => {
    const onOpenHistory = vi.fn();

    render(<MoreTab onOpenHistory={onOpenHistory} />);

    fireEvent.click(screen.getByRole("button", { name: /^History$/i }));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("opens the off-ramp modal", () => {
    render(<MoreTab />);
    fireEvent.click(
      screen.getByRole("button", { name: /Convert to CAD and Cash Out/i })
    );
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Convert and Off-ramp");
  });

  it("opens the charity summary and allows changing the default charity", () => {
    render(<MoreTab />);
    fireEvent.click(
      screen.getByRole("button", { name: /Charity Contributions/i })
    );
    expect(openModal).toHaveBeenCalled();
    const modalArgs = openModal.mock.calls[0][0];
    expect(modalArgs.title).toBe("Charitable Contributions");

    const modal = render(modalArgs.content as React.ReactElement);
    fireEvent.click(modal.getByTestId("charity-summary"));
    expect(openModal).toHaveBeenCalledTimes(2);
    expect(openModal.mock.calls[1][0].title).toBe("Change Default Charity");
    modal.unmount();
  });

  it("opens the profile modal", () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Edit Profile");
  });

  it("opens the theme selector", () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Select Theme/i }));
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Select Theme");
  });

  it("opens BIA Preferences in a dedicated modal", () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /BIA Preferences/i }));
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("BIA Preferences");
  });

  it("opens Voucher Routing Preferences in a dedicated modal", () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Voucher Routing Preferences/i }));
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Voucher Routing Preferences");
  });

  it("opens Future app features in a dedicated modal", () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Future app features/i }));
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Future app features");
  });

  it("does not render admin controls for non-admin users", () => {
    render(<MoreTab />);
    expect(screen.queryByRole("button", { name: /Open Admin Dashboard/i })).toBeNull();
  });

  it("shows the admin dashboard shortcut when the user is an admin", () => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          is_admin: true,
          activeProfile: createProfile(),
        },
      },
    });
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessAdminDashboard: true,
        canAccessCityManager: true,
      },
    });

    render(<MoreTab />);

    const cityAdminButton = screen.getByRole("button", { name: /Open City Admin/i });
    expect(cityAdminButton).toBeTruthy();

    fireEvent.click(cityAdminButton);
    expect(pushMock).toHaveBeenCalledWith("/city-admin");

    const adminButton = screen.getByRole("button", { name: /Open Admin Dashboard/i });
    expect(adminButton).toBeTruthy();

    fireEvent.click(adminButton);
    expect(pushMock).toHaveBeenCalledWith("/admin");
  });
});
