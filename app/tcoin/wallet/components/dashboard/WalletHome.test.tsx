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
  useControlVariables: () => ({ exchangeRate: 1 }),
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

const matchMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [{ id: 7 }], error: null })
);
const insertMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const fromMock = vi.hoisted(() => vi.fn((table: string) => {
  if (table === "users") {
    return { select: () => ({ match: matchMock }) } as any;
  }
  if (table === "wallet_list") {
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) } as any;
  }
  if (table === "act_transaction_entries") {
    return {
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as any;
  }
  if (table === "invoice_pay_request") {
    return {
      select: () => ({
        or: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    } as any;
  }
  return { insert: insertMock, select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) } as any;
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn<(...args: any[]) => Promise<any[]>>(async () => []));
vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: (...args: any[]) => (fetchContactsForOwnerMock as any)(...args),
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
    matchMock.mockClear();
    insertMock.mockClear();
    sendCardMock.mockClear();
    fetchContactsForOwnerMock.mockReset();
    fetchContactsForOwnerMock.mockResolvedValue([]);
    pushMock.mockReset();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("skips handleScan when URL lacks pay param", () => {
    render(<WalletHome />);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(matchMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
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
      expect(matchMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
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
    fetchContactsForOwnerMock.mockResolvedValueOnce([
      {
        id: 77,
        full_name: "Recent Contact",
        username: "recent",
        profile_image_url: null,
        wallet_address: null,
        state: "accepted",
        last_interaction: "2026-03-11T10:00:00.000Z",
      },
    ] as any[]);

    render(<WalletHome />);

    const buttons = await screen.findAllByRole("button", {
      name: /Open profile for Recent Contact/i,
    });
    fireEvent.click(buttons[0]);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/contacts/77");
  });
});
