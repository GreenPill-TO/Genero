/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSendMoneyMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    senderWallet: "0x-sender-from-hook",
    sendMoney: vi.fn(),
    getLastTransferRecord: vi.fn(),
  })
);

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: { cubidData: { id: 42, wallet_address: "0xabc" } },
  }),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1, state: "ready", loading: false, error: null }),
}));

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: useSendMoneyMock,
}));

const useTokenBalanceMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ balance: "10" })
);

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: useTokenBalanceMock,
}));

const invoiceRequests = [
  {
    id: 1,
    amountRequested: 12,
    requestFrom: 42,
    requestBy: 99,
    status: "pending",
    createdAt: "2024-05-01T00:00:00Z",
    isActive: true,
    isOpen: true,
    requesterFullName: "Requester One",
    requesterUsername: "requester",
    requesterProfileImageUrl: null,
    requesterWalletPublicKey: "0xwallet",
  },
  {
    id: 2,
    amountRequested: 0,
    requestFrom: 42,
    requestBy: 100,
    status: "pending",
    createdAt: "2024-06-01T00:00:00Z",
    isActive: true,
    isOpen: true,
    requesterFullName: "Requester Two",
    requesterUsername: "variable",
    requesterProfileImageUrl: null,
    requesterWalletPublicKey: "0xwallet2",
  },
  {
    id: 3,
    amountRequested: 5,
    requestFrom: 42,
    requestBy: 101,
    status: "pending",
    createdAt: "2024-07-01T00:00:00Z",
    isActive: false,
    isOpen: false,
    requesterFullName: "Requester Three",
    requesterUsername: "hidden",
    requesterProfileImageUrl: null,
    requesterWalletPublicKey: "0xwallet3",
  },
];
const dismissPaymentRequestMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ request: { id: 1 } })));
const markPaymentRequestPaidMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ request: { id: 1, status: "paid" } })));
const getIncomingPaymentRequestsMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ citySlug: "tcoin", requests: invoiceRequests }))
);

vi.mock("@shared/lib/edge/paymentRequestsClient", () => ({
  dismissPaymentRequest: dismissPaymentRequestMock,
  markPaymentRequestPaid: markPaymentRequestPaidMock,
  getIncomingPaymentRequests: getIncomingPaymentRequestsMock,
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: (_column: string, value: any) => ({
              single: () => {
                return Promise.resolve({
                  data: {
                    id: Number(value),
                    full_name: "Requester Fallback",
                    username: "fallback",
                    profile_image_url: null,
                  },
                  error: null,
                });
              },
            }),
            match: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }

      if (table === "wallet_list") {
        return {
          select: () => ({
            eq: (_column: string, value: any) => ({
              single: () => {
                return Promise.resolve({
                  data: { public_key: `0xwallet-${String(value)}` },
                  error: null,
                });
              },
            }),
          }),
        };
      }

      return {
        select: () => ({
          match: () => ({ neq: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    },
  }),
}));

vi.mock("@shared/utils/insertNotification", () => ({ insertSuccessNotification: vi.fn() }));

vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let sendCardProps: any;

vi.mock("./SendCard", () => ({
  SendCard: (props: any) => {
    sendCardProps = props;
    return (
      <div data-testid="sendcard">
        {props.amountHeaderActions}
        <input placeholder="0" onChange={props.handleTcoinChange} />
      </div>
    );
  },
}));


vi.mock("@tcoin/wallet/components/modals", () => ({
  QrScanModal: () => <div>qr-modal</div>,
}));

import { SendTab } from "./SendTab";

afterEach(() => {
  cleanup();
  sendCardProps = undefined;
  dismissPaymentRequestMock.mockClear();
  markPaymentRequestPaidMock.mockClear();
  getIncomingPaymentRequestsMock.mockClear();
  useTokenBalanceMock.mockClear();
});

describe("SendTab", () => {
  it("provides sender and receiver IDs to useSendMoney", () => {
    render(<SendTab recipient={{ id: 123 } as any} />);
    expect(useSendMoneyMock).toHaveBeenCalledWith({
      senderId: 42,
      receiverId: 123,
    });
  });

  it("renders send mode actions and shows inline QR scanner panel", () => {
    render(<SendTab recipient={null} />);
    expect(screen.getByTestId("send-tab-layout").className).not.toContain("lg:px-[25vw]");
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("Scan QR Code")).toBeTruthy();
    expect(screen.getByText("Pay Link")).toBeTruthy();
    expect(screen.getByText("Requests")).toBeTruthy();
    fireEvent.click(screen.getByText("Scan QR Code"));
    expect(screen.getByText("Scan QR")).toBeTruthy();
    expect(screen.getByText("qr-modal")).toBeTruthy();
  });

  it("passes numeric userBalance to SendCard", () => {
    render(<SendTab recipient={null} />);
    expect(sendCardProps.userBalance).toBe(10);
  });

  it("derives the balance using the sender wallet from useSendMoney", () => {
    render(<SendTab recipient={null} />);
    expect(useTokenBalanceMock).toHaveBeenCalledWith("0x-sender-from-hook");
  });

  it("keeps the provided recipient when the tab initialises", () => {
    render(<SendTab recipient={{ id: 7 } as any} />);
    expect(sendCardProps.toSendData).toEqual({ id: 7 });
  });

  it("emits recipient changes through onRecipientChange", () => {
    const onRecipientChange = vi.fn();
    render(<SendTab recipient={null} onRecipientChange={onRecipientChange} />);
    act(() => {
      sendCardProps.setToSendData({ id: 11 } as any);
    });
    expect(onRecipientChange).toHaveBeenCalledWith({ id: 11 });
    act(() => {
      sendCardProps.setToSendData(null);
    });
    expect(onRecipientChange).toHaveBeenCalledWith(null);
  });

  it("shows incoming requests in-panel", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    expect(screen.getByText("Incoming Requests To Pay")).toBeTruthy();
    expect(screen.getByText("12.00 TCOIN")).toBeTruthy();
    expect(screen.getByText("Any Amount")).toBeTruthy();
    expect(screen.getByText(/Requested by Requester One/i)).toBeTruthy();
    const payButtons = screen.getAllByRole("button", { name: /^Pay$/i });
    const ignoreButtons = screen.getAllByRole("button", { name: /^Ignore$/i });
    expect(payButtons).toHaveLength(2);
    expect(ignoreButtons).toHaveLength(2);
    expect(payButtons[0].className).toContain("bg-primary");
    expect(ignoreButtons[0].className).toContain("bg-white");
  });

  it("locks the send card when a request is selected", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const selectButton = screen.getAllByRole("button", { name: /^Pay$/i })[0];

    await act(async () => {
      fireEvent.click(selectButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendCardProps.locked).toBe(true);
    expect(sendCardProps.lockRecipient).toBe(true);
    expect(sendCardProps.lockAmount).toBe(true);
    expect(sendCardProps.recipientHeading).toBe("Requested By:");
    expect(sendCardProps.actionLabel).toBe("Pay this request");
    expect(typeof sendCardProps.onPaymentComplete).toBe("function");
  });

  it("keeps variable requests editable and updates the heading", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const payButtons = screen.getAllByRole("button", { name: /^Pay$/i });
    const variableButton = payButtons[1];

    await act(async () => {
      fireEvent.click(variableButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendCardProps.lockRecipient).toBe(true);
    expect(sendCardProps.lockAmount).toBe(false);
    expect(sendCardProps.recipientHeading).toBe("Requested By:");
    expect(sendCardProps.tcoinAmount).toBe("");
    expect(sendCardProps.cadAmount).toBe("");
  });

  it("allows ignoring a request to archive it", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const ignoreButtons = screen.getAllByRole("button", { name: /^Ignore$/i });

    await act(async () => {
      fireEvent.click(ignoreButtons[0]);
      await Promise.resolve();
    });

    expect(dismissPaymentRequestMock).toHaveBeenCalledWith({
      requestId: 1,
      appContext: { citySlug: "tcoin" },
    });
  });

  it("marks the selected request as paid when payment completes", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const selectButton = screen.getAllByRole("button", { name: /^Pay$/i })[0];

    await act(async () => {
      fireEvent.click(selectButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    const paymentComplete = sendCardProps.onPaymentComplete as (
      details: any
    ) => Promise<void>;
    expect(typeof paymentComplete).toBe("function");

    await act(async () => {
      await paymentComplete({
        transactionHash: "0xdeadbeef",
        transactionId: 77,
      });
    });

    expect(markPaymentRequestPaidMock).toHaveBeenCalledWith({
      requestId: 1,
      transactionId: 77,
      appContext: { citySlug: "tcoin" },
    });
  });

  it("extracts the transaction id from transfer metadata when not provided", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const selectButton = screen.getAllByRole("button", { name: /^Pay$/i })[0];

    await act(async () => {
      fireEvent.click(selectButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    const paymentComplete = sendCardProps.onPaymentComplete as (
      details: any
    ) => Promise<void>;

    await act(async () => {
      await paymentComplete({
        transactionHash: "0xfeed",
        transferRecord: { transaction_id: "88" },
      });
    });

    expect(markPaymentRequestPaidMock).toHaveBeenCalledWith({
      requestId: 1,
      transactionId: 88,
      appContext: { citySlug: "tcoin" },
    });
  });
});
