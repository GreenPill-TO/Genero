/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const openModal = vi.fn();
vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal: vi.fn() }),
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


vi.mock("@tcoin/wallet/components/modals", () => ({
  QrScanModal: () => <div>qr-modal</div>,
}));

import { SendTab } from "./SendTab";

afterEach(() => {
  cleanup();
  sendCardProps = undefined;
  openModal.mockReset();
});

describe("SendTab", () => {
  it("provides sender and receiver IDs to useSendMoney", () => {
    render(<SendTab recipient={{ id: 123 } as any} />);
    expect(useSendMoneyMock).toHaveBeenCalledWith({
      senderId: 42,
      receiverId: 123,
    });
  });

  it("renders mode toggle and opens modal in QR mode", () => {
    render(<SendTab recipient={null} />);
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("Scan QR Code")).toBeTruthy();
    expect(screen.getByText("Pay Link")).toBeTruthy();
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
});

