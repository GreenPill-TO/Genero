/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

describe("SendTab", () => {
  it("provides sender and receiver IDs to useSendMoney", () => {
    render(<SendTab recipient={{ id: 123 } as any} />);
    expect(useSendMoneyMock).toHaveBeenCalledWith({
      senderId: 42,
      receiverId: 123,
    });
  });

  it("shows scanner by default when no recipient", () => {
    const { getByTestId } = render(<SendTab recipient={null} />);
    expect(getByTestId("scanner")).toBeTruthy();
  });
});

