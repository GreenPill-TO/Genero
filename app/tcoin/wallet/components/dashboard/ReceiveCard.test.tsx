/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReceiveCard } from "./ReceiveCard";

const openModalMock = vi.fn();
const closeModalMock = vi.fn();

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: openModalMock, closeModal: closeModalMock }),
}));

vi.mock("@shared/hooks/useDarkMode", () => ({
  __esModule: true,
  default: () => ({ isDarkMode: false }),
}));

vi.mock("react-qr-code", () => ({
  __esModule: true,
  default: () => <div data-testid="qr-code" />,
}));

const createProps = () => ({
  qrCodeData: "payload",
  qrTcoinAmount: "",
  qrCadAmount: "",
  handleQrTcoinChange: vi.fn(),
  handleQrCadChange: vi.fn(),
  senderWallet: "wallet",
  handleQrTcoinBlur: vi.fn(),
  handleQrCadBlur: vi.fn(),
  tokenLabel: "TCOIN",
  requestContact: null as any,
  onClearRequestContact: vi.fn(),
  contacts: [],
  onSelectRequestContact: vi.fn(),
});

const renderReceiveCard = (overrides: Partial<ReturnType<typeof createProps>> = {}) => {
  const props = { ...createProps(), ...overrides };
  return render(<ReceiveCard {...(props as any)} />);
};


describe("ReceiveCard", () => {
  beforeEach(() => {
    openModalMock.mockReset();
    closeModalMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the contact selector without requiring an amount", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderReceiveCard();

    fireEvent.click(screen.getByRole("button", { name: /Request from Contact/i }));

    expect(openModalMock).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("renames the share button to create a shareable request", () => {
    renderReceiveCard();

    expect(
      screen.getByRole("button", { name: /Create a shareable request/i })
    ).toBeTruthy();
  });

  it("does not display the balance footer", () => {
    renderReceiveCard();

    expect(screen.queryByText(/Balance:/i)).toBeNull();
  });
});
