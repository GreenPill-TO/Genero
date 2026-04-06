/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleWalletHome } from "./SimpleWalletHome";

const useAuthMock = vi.hoisted(() => vi.fn());
const useSendMoneyMock = vi.hoisted(() => vi.fn());
const useTokenBalanceMock = vi.hoisted(() => vi.fn());
const useControlVariablesMock = vi.hoisted(() => vi.fn());
const openModalMock = vi.hoisted(() => vi.fn());
const closeModalMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: () => useSendMoneyMock(),
}));

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: () => useTokenBalanceMock(),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => useControlVariablesMock(),
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({
    openModal: openModalMock,
    closeModal: closeModalMock,
  }),
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
  BuyTcoinModal: () => <div data-testid="buy-tcoin-modal" />,
  TopUpModal: () => <div data-testid="top-up-modal" />,
}));

describe("SimpleWalletHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          id: 1001,
        },
      },
    });
    useSendMoneyMock.mockReturnValue({
      senderWallet: "0x1111111111111111111111111111111111111001",
    });
    useTokenBalanceMock.mockReturnValue({
      balance: "42.5",
    });
    useControlVariablesMock.mockReturnValue({
      exchangeRate: 3.35,
      fallbackMessage: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a floating buy menu with Interac and Credit Card options", () => {
    render(<SimpleWalletHome />);

    fireEvent.click(screen.getByRole("button", { name: /Buy more TCOIN/i }));

    expect(screen.getByRole("menu", { name: /Buy more TCOIN options/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Top up with Interac/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Top up with Credit Card/i })).toBeTruthy();
  });

  it("opens the Interac top-up modal from the floating menu", () => {
    render(<SimpleWalletHome />);

    fireEvent.click(screen.getByRole("button", { name: /Buy more TCOIN/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Top up with Interac/i }));

    expect(openModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Top Up with Interac eTransfer",
      })
    );
  });

  it("opens the buy-tcoin modal from the floating menu", () => {
    render(<SimpleWalletHome />);

    fireEvent.click(screen.getByRole("button", { name: /Buy more TCOIN/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Top up with Credit Card/i }));

    expect(openModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy TCOIN",
      })
    );
  });
});
