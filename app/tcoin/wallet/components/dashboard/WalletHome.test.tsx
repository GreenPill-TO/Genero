/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("react-toastify", () => ({
  toast: { success: toastSuccess },
}));

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

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: () => ({ senderWallet: "0xabc", sendMoney: vi.fn() }),
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
const lookupWalletUserByIdentifierMock = vi.hoisted(() => vi.fn());
const connectWalletContactMock = vi.hoisted(() => vi.fn());
const getWalletRecentsMock = vi.hoisted(() => vi.fn(async () => ({ participants: [] })));
vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  lookupWalletUserByIdentifier: lookupWalletUserByIdentifierMock,
  connectWalletContact: connectWalletContactMock,
  getWalletRecents: getWalletRecentsMock,
}));

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
  QrScanModal: () => <div>qr-modal</div>,
}));

vi.mock("./ContributionsCard", () => ({
  ContributionsCard: () => <div />,
}));
const sendCardMock = vi.hoisted(() => vi.fn(() => <div />));
vi.mock("./SendCard", () => ({
  SendCard: (props: any) => (sendCardMock as any)(props),
}));
vi.mock("./AccountCard", () => ({ AccountCard: () => <div /> }));
vi.mock("./OtherCard", () => ({ OtherCard: () => <div /> }));

import { WalletHome } from "./WalletHome";

describe("WalletHome deep-link scanning", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    sendCardMock.mockClear();
    lookupWalletUserByIdentifierMock.mockReset();
    lookupWalletUserByIdentifierMock.mockResolvedValue({
      user: {
        id: 7,
        fullName: "Scanned User",
        username: "scanned",
        profileImageUrl: null,
        walletAddress: "0x123",
        state: "new",
      },
    });
    connectWalletContactMock.mockReset();
    connectWalletContactMock.mockResolvedValue({ contact: null });
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

  it("skips handleScan when URL lacks pay param", () => {
    render(<WalletHome />);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(lookupWalletUserByIdentifierMock).not.toHaveBeenCalled();
    expect(connectWalletContactMock).not.toHaveBeenCalled();
  });

  it("processes scan and shows toast when URL has pay param", async () => {
    const payload = btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({ nano_id: "target", qrTcoinAmount: "2" })
        )
      )
    );
    window.history.replaceState({}, "", `/dashboard?pay=${payload}`);

    render(<WalletHome />);

    await waitFor(() => {
      expect(lookupWalletUserByIdentifierMock).toHaveBeenCalled();
      expect(connectWalletContactMock).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith("Scanned User Successfully");
    });
  });

  it("passes numeric userBalance to SendCard", () => {
    tokenBalanceMock.mockReturnValueOnce({ balance: "5.5" });
    render(<WalletHome />);
    expect(sendCardMock).toHaveBeenCalled();
    const props = (sendCardMock.mock.calls[0] as any[] | undefined)?.[0] as { userBalance?: number } | undefined;
    expect(props?.userBalance).toBe(5.5);
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
    fireEvent.click(buttons[0]);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/contacts/77");
  });
});
