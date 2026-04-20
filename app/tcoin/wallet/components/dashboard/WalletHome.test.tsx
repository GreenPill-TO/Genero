/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: {
      cubidData: {
        id: 42,
        user_identifier: "abc",
        activeProfile: {
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
        },
      },
    },
  }),
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), closeModal: vi.fn() }),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1, state: "ready", loading: false, error: null }),
}));

vi.mock("@shared/hooks/useCurrentWalletAddress", () => ({
  useCurrentWalletAddress: () => ({ walletAddress: "0xabc" }),
}));

const tokenBalanceMock = vi.hoisted(() => vi.fn(() => ({ balance: "0" })));

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: tokenBalanceMock,
}));

const getVoucherMerchantsMock = vi.hoisted(() => vi.fn(async () => ({ merchants: [] })));
vi.mock("@shared/lib/edge/voucherPreferencesClient", () => ({
  getVoucherMerchants: getVoucherMerchantsMock,
}));
const getRecentPaymentRequestParticipantsMock = vi.hoisted(() =>
  vi.fn(async () => ({ citySlug: "tcoin", participants: [] }))
);
vi.mock("@shared/lib/edge/paymentRequestsClient", () => ({
  getRecentPaymentRequestParticipants: getRecentPaymentRequestParticipantsMock,
}));
type WalletRecentParticipant = {
  id: number;
  fullName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  walletAddress: string | null;
  state: string | null;
  lastInteractionAt: string | null;
};

const getWalletRecentsMock = vi.hoisted(() =>
  vi.fn(async (): Promise<{ participants: WalletRecentParticipant[] }> => ({ participants: [] }))
);
vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  getWalletRecents: getWalletRecentsMock,
}));

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("./ContributionsCard", () => ({
  ContributionsCard: () => <div />,
}));
vi.mock("./AccountCard", () => ({ AccountCard: () => <div /> }));
vi.mock("./OtherCard", () => ({ OtherCard: () => <div /> }));

import { WalletHome } from "./WalletHome";

describe("WalletHome", () => {
  beforeEach(() => {
    getWalletRecentsMock.mockReset();
    getWalletRecentsMock.mockResolvedValue({ participants: [] });
    getRecentPaymentRequestParticipantsMock.mockReset();
    getRecentPaymentRequestParticipantsMock.mockResolvedValue({
      citySlug: "tcoin",
      participants: [],
    });
    pushMock.mockReset();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("does not render the send panel on home", () => {
    render(<WalletHome />);
    expect(screen.queryByTestId("wallet-home-send-grid")).toBeNull();
  });

  it("adds ultra-wide layout tracks for home sections", () => {
    render(<WalletHome />);

    expect(screen.getAllByTestId("wallet-home-summary-grid")[0].className).toContain(
      "min-[1850px]:grid-cols-[minmax(0,1.18fr)_minmax(0,1.05fr)_minmax(320px,0.92fr)]"
    );
    expect(screen.getAllByTestId("wallet-home-support-grid")[0].className).toContain(
      "min-[1850px]:grid-cols-[minmax(0,1.08fr)_minmax(0,0.94fr)_minmax(320px,0.78fr)]"
    );
  });

  it("routes to More from the account-settings prompt", () => {
    render(<WalletHome />);

    fireEvent.click(screen.getAllByRole("button", { name: /Open More/i })[0]);
    expect(pushMock).toHaveBeenCalledWith("/dashboard?tab=more");
  });

  it("opens contact profile page from Recents avatar", async () => {
    getWalletRecentsMock.mockResolvedValueOnce({
      participants: [
        {
          id: 77,
          fullName: "Recent Contact",
          username: "recent",
          profileImageUrl: null,
          walletAddress: null,
          state: "accepted",
          lastInteractionAt: "2026-03-11T10:00:00.000Z",
        },
      ],
    });

    render(<WalletHome />);

    const buttons = await screen.findAllByRole("button", {
      name: /Open profile for Recent Contact/i,
    });
    expect(buttons[0].className).toContain("ring-teal-500/12");
    expect(buttons[0].className).toContain("before:bg-teal-600/40");
    fireEvent.click(buttons[0]);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/contacts/77");
  });
});
