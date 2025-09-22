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

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
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
  CharitySelectModal: ({ setSelectedCharity }: any) => (
    <button
      data-testid="charity-select"
      onClick={() => setSelectedCharity("New Charity")}
    >
      select
    </button>
  ),
  CharityContributionsModal: ({ onChangeCharity }: any) => (
    <button data-testid="charity-summary" onClick={onChangeCharity}>
      change
    </button>
  ),
  ThemeSelectModal: () => <div data-testid="theme-modal" />,
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
  });

  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    pushMock.mockReset();
  });

  it("opens the top up modal", () => {
    render(<MoreTab />);
    fireEvent.click(
      screen.getByRole("button", { name: /Top Up with Interac eTransfer/i })
    );
    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe(
      "Top Up with Interac eTransfer"
    );
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

    render(<MoreTab />);

    const adminButton = screen.getByRole("button", { name: /Open Admin Dashboard/i });
    expect(adminButton).toBeTruthy();

    fireEvent.click(adminButton);
    expect(pushMock).toHaveBeenCalledWith("/admin");
  });
});
