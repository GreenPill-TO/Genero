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
  useTokenBalance: () => ({ balance: "0" }),
}));

vi.mock("./SendCard", () => ({
  SendCard: () => <div data-testid="send-card" />,
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
    expect(screen.getByTestId("send-card")).toBeTruthy();
    expect(screen.queryByTestId("scanner")).toBeNull();
    // switch to QR
    fireEvent.click(screen.getByText("QR"));
    expect(screen.getByTestId("scanner")).toBeTruthy();
  });
});

