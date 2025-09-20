/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReceiveCard } from "./ReceiveCard";

const openModalMock = vi.fn();
const closeModalMock = vi.fn();
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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

vi.mock("react-toastify", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
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
  openRequests: [],
  onCreateShareableRequest: vi.fn().mockResolvedValue(null),
  showQrCode: true,
});

const renderReceiveCard = (overrides: Partial<ReturnType<typeof createProps>> = {}) => {
  const props = { ...createProps(), ...overrides };
  return render(<ReceiveCard {...(props as any)} />);
};


describe("ReceiveCard", () => {
  beforeEach(() => {
    openModalMock.mockReset();
    closeModalMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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

  it("saves a shareable request before opening the share modal", async () => {
    const onCreateShareableRequest = vi.fn().mockResolvedValue({ id: 1 });
    renderReceiveCard({ qrTcoinAmount: "12", onCreateShareableRequest });

    const shareButton = screen.getByRole("button", {
      name: /Create a shareable request/i,
    });

    await act(async () => {
      fireEvent.click(shareButton);
      await Promise.resolve();
    });

    expect(onCreateShareableRequest).toHaveBeenCalledWith(12);
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Request for 12.00 TCOIN has been saved."
    );
    expect(openModalMock).toHaveBeenCalled();
  });

  it("renders grouped open requests with share actions", () => {
    renderReceiveCard({
      openRequests: [
        {
          id: 1,
          amount_requested: 5,
          request_from: null,
          created_at: "2024-01-01T00:00:00Z",
        } as any,
        {
          id: 2,
          amount_requested: 3,
          request_from: 42,
        } as any,
      ],
      contacts: [
        {
          id: 42,
          full_name: "Alice Example",
          username: "alice",
          profile_image_url: null,
          wallet_address: null,
          state: "added",
          last_interaction: null,
        },
      ],
    });

    expect(screen.getByText(/Open Requests/i)).toBeTruthy();
    const shareableLabels = screen.getAllByText(/Shareable/i, { selector: "p" });
    expect(shareableLabels.length).toBeGreaterThan(0);
    const targetedLabels = screen.getAllByText(/To Contacts/i, { selector: "p" });
    expect(targetedLabels.length).toBeGreaterThan(0);
    expect(screen.getByText(/Request sent to Alice Example/i)).toBeTruthy();

    const shareButtons = screen.getAllByRole("button", { name: /^Share$/i });
    expect(shareButtons.length).toBeGreaterThan(0);

    fireEvent.click(shareButtons[0]);
    expect(openModalMock).toHaveBeenCalled();
  });
});
