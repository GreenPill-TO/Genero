/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSendMoneyMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
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
  useControlVariables: () => ({ exchangeRate: 1 }),
}));

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: useSendMoneyMock,
}));

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: () => ({ balance: "10" }),
}));

const openModal = vi.fn();
vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal: vi.fn() }),
}));

const invoiceRequests = [
  {
    id: 1,
    amount_requested: 12,
    request_from: 42,
    request_by: 99,
    status: "pending",
    created_at: "2024-05-01T00:00:00Z",
  },
  {
    id: 2,
    amount_requested: 0,
    request_from: 42,
    request_by: 100,
    status: "pending",
    created_at: "2024-06-01T00:00:00Z",
  },
];
const requesterRows = [
  {
    id: 99,
    full_name: "Requester One",
    username: "requester",
    profile_image_url: null,
  },
  {
    id: 100,
    full_name: "Requester Two",
    username: "variable",
    profile_image_url: null,
  },
];
const walletRows = [
  { user_id: 99, public_key: "0xwallet" },
  { user_id: 100, public_key: "0xwallet2" },
];
const updateEqMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "invoice_pay_request") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: invoiceRequests, error: null }),
            }),
          }),
          update: updateMock,
        };
      }

      if (table === "users") {
        return {
          select: () => ({
            in: (_column: string, values: any[]) => {
              const ids = values.map((value) => Number(value));
              const matches = requesterRows.filter((row) => ids.includes(row.id));
              return Promise.resolve({ data: matches, error: null });
            },
            eq: (_column: string, value: any) => ({
              single: () => {
                const id = Number(value);
                const match = requesterRows.find((row) => row.id === id) ?? null;
                return Promise.resolve({ data: match, error: null });
              },
            }),
            match: () => Promise.resolve({ data: requesterRows, error: null }),
          }),
        };
      }

      if (table === "wallet_list") {
        return {
          select: () => ({
            in: (_column: string, values: any[]) => {
              const ids = values.map((value) => Number(value));
              const matches = walletRows.filter((row) => ids.includes(Number(row.user_id)));
              return Promise.resolve({ data: matches, error: null });
            },
            eq: (_column: string, value: any) => ({
              single: () => {
                const id = Number(value);
                const match = walletRows.find((row) => Number(row.user_id) === id) ?? null;
                return Promise.resolve({ data: match, error: null });
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
  openModal.mockReset();
  updateMock.mockReset();
  updateEqMock.mockReset();
});

describe("SendTab", () => {
  it("provides sender and receiver IDs to useSendMoney", () => {
    render(<SendTab recipient={{ id: 123 } as any} />);
    expect(useSendMoneyMock).toHaveBeenCalledWith({
      senderId: 42,
      receiverId: 123,
    });
  });

  it("renders send mode actions and opens the QR scanner", () => {
    render(<SendTab recipient={null} />);
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("Scan QR Code")).toBeTruthy();
    expect(screen.getByText("Pay Link")).toBeTruthy();
    expect(screen.getByText("Requests")).toBeTruthy();
    fireEvent.click(screen.getByText("Scan QR Code"));
    expect(openModal).toHaveBeenCalled();
  });

  it("passes numeric userBalance to SendCard", () => {
    render(<SendTab recipient={null} />);
    expect(sendCardProps.userBalance).toBe(10);
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

  it("opens the requests modal with pending entries", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    expect(openModal).toHaveBeenCalled();
    const modalArgs = openModal.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);
    expect(modal.getByText("12.00 TCOIN")).toBeTruthy();
    expect(modal.getByText("Any Amount")).toBeTruthy();
    expect(modal.getByText(/Requested by Requester One/i)).toBeTruthy();
    modal.unmount();
  });

  it("locks the send card when a request is selected", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const modalArgs = openModal.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);
    const selectButton = modal.getByRole("button", { name: /Requester One/i });

    await act(async () => {
      fireEvent.click(selectButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    modal.unmount();

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

    const modalArgs = openModal.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);
    const variableButton = modal.getByRole("button", { name: /Any Amount/i });

    await act(async () => {
      fireEvent.click(variableButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    modal.unmount();

    expect(sendCardProps.lockRecipient).toBe(true);
    expect(sendCardProps.lockAmount).toBe(false);
    expect(sendCardProps.recipientHeading).toBe("Requested By:");
    expect(sendCardProps.tcoinAmount).toBe("");
    expect(sendCardProps.cadAmount).toBe("");
  });

  it("marks the selected request as paid when payment completes", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const modalArgs = openModal.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);
    const selectButton = modal.getByRole("button", { name: /Requester One/i });

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

    expect(updateMock).toHaveBeenCalledWith({
      status: "paid",
      paid_at: expect.any(String),
      transaction_id: 77,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", 1);

    modal.unmount();
  });

  it("extracts the transaction id from transfer metadata when not provided", async () => {
    render(<SendTab recipient={null} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Requests"));
      await Promise.resolve();
    });

    const modalArgs = openModal.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);
    const selectButton = modal.getByRole("button", { name: /Requester One/i });

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

    expect(updateMock).toHaveBeenCalledWith({
      status: "paid",
      paid_at: expect.any(String),
      transaction_id: 88,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", 1);

    modal.unmount();
  });
});

