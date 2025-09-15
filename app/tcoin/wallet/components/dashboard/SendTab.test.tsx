/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSendMoneyMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ sendMoney: vi.fn() })
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

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), closeModal: vi.fn() }),
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ match: () => ({ neq: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
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
        <input placeholder="0" onChange={props.handleTcoinChange} />
      </div>
    );
  },
}));

vi.mock("./SendQrPanel", () => ({
  SendQrPanel: () => <div data-testid="scanner" />,
}));

vi.mock("./ContactsTab", () => ({
  ContactsTab: () => <div>contacts</div>,
}));

import { SendTab } from "./SendTab";

afterEach(() => {
  cleanup();
  sendCardProps = undefined;
});

describe("SendTab", () => {
  it("provides sender and receiver IDs to useSendMoney", () => {
    render(<SendTab recipient={{ id: 123 } as any} />);
    expect(useSendMoneyMock).toHaveBeenCalledWith({
      senderId: 42,
      receiverId: 123,
    });
  });

  it("renders mode toggle and shows scanner in QR mode", () => {
    render(<SendTab recipient={null} />);
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("QR")).toBeTruthy();
    expect(screen.getByText("Pay Link")).toBeTruthy();
    // default manual
    expect(screen.getByPlaceholderText("0")).toBeTruthy();
    expect(screen.queryByTestId("scanner")).toBeNull();
    // switch to QR
    fireEvent.click(screen.getByText("QR"));
    expect(screen.getByTestId("scanner")).toBeTruthy();
  });

  it("passes numeric userBalance to SendCard", () => {
    render(<SendTab recipient={null} />);
    expect(sendCardProps.userBalance).toBe(10);
  });

  it("shows contact options only after entering amount", () => {
    render(<SendTab recipient={null} />);
    expect(screen.queryByText(/scan qr code/i)).toBeNull();
    const input = screen.getByPlaceholderText("0");
    fireEvent.change(input, { target: { value: "1" } });
    expect(screen.getByText(/scan qr code/i)).toBeTruthy();
    expect(screen.getByText(/select contact/i)).toBeTruthy();
  });
});

