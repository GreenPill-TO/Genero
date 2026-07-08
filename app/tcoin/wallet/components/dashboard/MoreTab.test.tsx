/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openModal = vi.fn();
const closeModal = vi.fn();
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
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

const createBootstrap = (overrides: Partial<any> = {}) => ({
  user: {
    id: 123,
    cubidId: "cubid-123",
    userIdentifier: "wallet-user-123",
    fullName: "Taylor Example",
    firstName: "Taylor",
    lastName: "Example",
    nickname: "Tay",
    username: "taylorexample",
    email: "taylor@example.com",
    phone: "+14165550123",
    country: "CA",
    hasCompletedIntro: true,
    isNewUser: false,
    profileImageUrl: null,
    ...overrides,
  },
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
});

const createAuthState = (overrides: Partial<any> = {}) => ({
  authData: {
    user: {
      id: "auth-user-123",
    },
  },
  userData: {
    cubidData: {
      id: 123,
      cubid_id: "cubid-123",
      username: "taylorexample",
      email: "taylor@example.com",
      phone: "+14165550123",
      full_name: "Taylor Example",
      address: "123 Queen St W",
      bio: "Testing profile output",
      profile_image_url: null,
      has_completed_intro: true,
      is_new_user: false,
      is_admin: false,
      auth_user_id: null,
      cubid_score: { score: 88 },
      cubid_identity: { verified: true },
      cubid_score_details: { phone: "verified" },
      user_identifier: "wallet-user-123",
      given_names: "Taylor",
      family_name: "Example",
      nickname: "Tay",
      country: "CA",
      created_at: "2026-03-15T00:00:00.000Z",
      updated_at: "2026-03-20T00:00:00.000Z",
      activeProfile: createProfile(),
      ...overrides,
    },
  },
});

const useAuthMock = vi.hoisted(() =>
  vi.fn(() => createAuthState())
);
const useUserSettingsMock = vi.hoisted(() =>
  vi.fn(() => ({
    bootstrap: createBootstrap(),
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
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("@shared/hooks/useCurrentWalletAddress", () => ({
  useCurrentWalletAddress: () => ({ walletAddress: "0xabc1234567890def1234567890abcdef1234567" }),
}));

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: () => ({ balance: "12.34" }),
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

vi.mock("@tcoin/wallet/components/modals/OffRampModal", () => ({
  OffRampModal: ({ closeModal }: any) => (
    <button data-testid="offramp-modal" onClick={closeModal}>
      offramp
    </button>
  ),
}));

vi.mock("@tcoin/wallet/components/modals/CharitySelectModal", () => ({
  CharitySelectModal: () => <button data-testid="charity-select">select</button>,
}));

vi.mock("@tcoin/wallet/components/modals/CharityContributionsModal", () => ({
  CharityContributionsModal: ({ onChangeCharity }: any) => (
    <button data-testid="charity-summary" onClick={onChangeCharity}>
      change
    </button>
  ),
}));

vi.mock("@tcoin/wallet/components/modals/ThemeSelectModal", () => ({
  ThemeSelectModal: () => <div data-testid="theme-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/BiaPreferencesModal", () => ({
  BiaPreferencesModal: () => <div data-testid="bia-preferences-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/VoucherRoutingPreferencesModal", () => ({
  VoucherRoutingPreferencesModal: () => <div data-testid="voucher-routing-preferences-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/FutureAppFeaturesModal", () => ({
  FutureAppFeaturesModal: () => <div data-testid="future-features-modal" />,
}));

import { MoreTab } from "./MoreTab";

describe("MoreTab", () => {
  const originalExplorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_EXPLORER_URL = "https://env.example/address/";
    useAuthMock.mockReturnValue(createAuthState());
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap(),
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
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    pushMock.mockReset();
    getMerchantApplicationStatusMock.mockReset();
    getMerchantApplicationStatusMock.mockResolvedValue({ state: "none" });
    updateVoucherPreferencesMock.mockReset();
    updateVoucherPreferencesMock.mockResolvedValue({ preference: {} });
    if (originalExplorerUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXPLORER_URL;
    } else {
      process.env.NEXT_PUBLIC_EXPLORER_URL = originalExplorerUrl;
    }
  });

  it("does not render buy/top-up actions in the More tab", () => {
    render(<MoreTab />);
    expect(screen.queryByRole("button", { name: /Buy TCOIN/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Top Up with Interac eTransfer/i })).toBeNull();
  });

  it("opens history from the More tab overflow action", () => {
    const onOpenHistory = vi.fn();

    render(<MoreTab onOpenHistory={onOpenHistory} />);

    fireEvent.click(screen.getByRole("button", { name: /History/i }));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("opens Stats for Nerds from the More workspace actions", () => {
    render(<MoreTab />);

    fireEvent.click(screen.getByRole("button", { name: /Stats for Nerds/i }));

    expect(pushMock).toHaveBeenCalledWith("/stats");
  });

  it("lets action-row descriptions span the full text area", () => {
    render(<MoreTab />);

    const charityButton = screen.getByRole("button", { name: /Charity Contributions/i });
    const description = screen.getByText(
      /Review your current charity defaults and contribution totals, then change them if needed\./i
    );

    expect(charityButton.className).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(description.className).toContain("col-[2/4]");
  });

  it("adds ultra-wide layout tracks for the account overview and action sections", () => {
    render(<MoreTab />);

    expect(screen.getByTestId("more-tab-overview-grid").className).toContain(
      "min-[1850px]:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.74fr)_minmax(280px,0.74fr)]"
    );
    expect(screen.getByTestId("more-tab-actions-grid").className).toContain("min-[1850px]:grid-cols-3");
  });

  it("renders every current public.users column with known values and empty rows", () => {
    render(<MoreTab />);

    expect(screen.getByTestId("more-tab-public-users-card")).toBeTruthy();
    expect(screen.getByText("user_identifier")).toBeTruthy();
    expect(screen.getByText("wallet-user-123")).toBeTruthy();
    expect(screen.getByText("auth_user_id")).toBeTruthy();
    expect(screen.getByText("auth-user-123")).toBeTruthy();
    expect(screen.getByText("address")).toBeTruthy();
    expect(screen.getByText("123 Queen St W")).toBeTruthy();
    expect(screen.getByText("profile_image_url")).toBeTruthy();
    expect(screen.getAllByText("Empty").length).toBeGreaterThan(0);
  });

  it("gives long identity fields extra room and preserves wrapping", () => {
    render(<MoreTab />);

    const identityRow = screen.getByTestId("public-users-row-cubid_identity");
    expect(identityRow.className).toContain("space-y-2");
    expect(screen.getByText(/"verified": true/i).className).toContain("whitespace-pre-wrap");
  });

  it("opens the off-ramp modal", async () => {
    render(<MoreTab />);
    fireEvent.click(
      screen.getByRole("button", { name: /Convert to CAD and Cash Out/i })
    );
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("Convert and Off-ramp");
    });
  });

  it("opens the charity summary and allows changing the default charity", async () => {
    render(<MoreTab />);
    fireEvent.click(
      screen.getByRole("button", { name: /Charity Contributions/i })
    );
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
    });
    const modalArgs = openModal.mock.calls[0][0];
    expect(modalArgs.title).toBe("Charitable Contributions");

    const modal = render(modalArgs.content as React.ReactElement);
    fireEvent.click(modal.getByTestId("charity-summary"));
    await waitFor(() => {
      expect(openModal).toHaveBeenCalledTimes(2);
      expect(openModal.mock.calls[1][0].title).toBe("Change Default Charity");
    });
    modal.unmount();
  });

  it("opens the profile modal", async () => {
    render(<MoreTab />);
    fireEvent.click(screen.getAllByRole("button", { name: /Edit Profile/i })[0]);
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("Edit Profile");
      expect(openModal.mock.calls[0][0].elSize).toBe("5xl");
      expect(openModal.mock.calls[0][0].isResponsive).toBe(true);
    });
  });

  it("opens the theme selector", async () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Select Theme/i }));
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("Select Theme");
    });
  });

  it("opens BIA Preferences in a dedicated modal", async () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /BIA Preferences/i }));
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("BIA Preferences");
    });
  });

  it("opens Voucher Routing Preferences in a dedicated modal", async () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Voucher Routing Preferences/i }));
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("Voucher Routing Preferences");
    });
  });

  it("opens Future app features in a dedicated modal", async () => {
    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Future app features/i }));
    await waitFor(() => {
      expect(openModal).toHaveBeenCalled();
      expect(openModal.mock.calls[0][0].title).toBe("Future app features");
    });
  });

  it("does not render admin controls for non-admin users", () => {
    render(<MoreTab />);
    expect(screen.queryByRole("button", { name: /Open Admin Dashboard/i })).toBeNull();
  });

  it("shows wallet address details and explorer access in More", () => {
    render(<MoreTab />);

    expect(screen.getByText(/Wallet address/i)).toBeTruthy();
    expect(screen.getByText(/What this wallet optimises for/i)).toBeTruthy();
    const explorerLink = screen.getByRole("link", { name: /View on Explorer/i });
    expect(explorerLink.getAttribute("href")).toBe(
      "https://env.example/address/0xabc1234567890def1234567890abcdef1234567"
    );
  });

  it("shows the preferred name in the Account centre when one exists", () => {
    render(<MoreTab />);

    expect(screen.getByRole("heading", { name: "Tay" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Taylor" })).toBeNull();
  });

  it("falls back to the given name in the Account centre when preferred name is empty", () => {
    useAuthMock.mockReturnValue(
      createAuthState({
        nickname: "",
        given_names: "Taylor",
        full_name: "Taylor Example",
      })
    );
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap({
        nickname: "",
        firstName: "Taylor",
        fullName: "Taylor Example",
      }),
    });

    render(<MoreTab />);

    expect(screen.getByRole("heading", { name: "Taylor" })).toBeTruthy();
  });

  it("copies the wallet address from More", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<MoreTab />);
    fireEvent.click(screen.getByRole("button", { name: /Copy address/i }));

    expect(writeText).toHaveBeenCalledWith("0xabc1234567890def1234567890abcdef1234567");
  });

  it("shows the admin dashboard shortcut when the user is an admin", () => {
    useAuthMock.mockReturnValue(createAuthState({ is_admin: true }));
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
