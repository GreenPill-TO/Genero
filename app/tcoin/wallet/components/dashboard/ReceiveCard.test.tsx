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
  onCreateTargetedRequest: vi.fn().mockResolvedValue(null),
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

  it("shows only the review action when a contact is selected", () => {
    renderReceiveCard({
      requestContact: {
        id: 7,
        full_name: "Charlie Example",
      } as any,
    });

    expect(
      screen.getByRole("button", { name: /Review Request/i })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Request from Contact/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Create a shareable request/i })
    ).toBeNull();
  });

  it("surfaces warnings when the amount is zero", () => {
    renderReceiveCard({
      requestContact: {
        id: 3,
        full_name: "Alex Example",
      } as any,
      qrTcoinAmount: "0",
    });

    fireEvent.click(screen.getByRole("button", { name: /Review Request/i }));

    expect(openModalMock).toHaveBeenCalledTimes(1);
    const modalArgs = openModalMock.mock.calls[0][0];
    expect(modalArgs.title).toBe("Check request details");
  });

  it("requires acknowledging warnings before showing the review screen", async () => {
    renderReceiveCard({
      requestContact: {
        id: 8,
        full_name: "Morgan Example",
      } as any,
      qrTcoinAmount: "0",
    });

    fireEvent.click(screen.getByRole("button", { name: /Review Request/i }));

    const warningArgs = openModalMock.mock.calls[0][0];
    const warningModal = render(warningArgs.content as React.ReactElement);
    const continueButton = warningModal.getByRole("button", {
      name: /Continue to Review/i,
    });

    await act(async () => {
      fireEvent.click(continueButton);
      await Promise.resolve();
    });

    warningModal.unmount();

    expect(closeModalMock).toHaveBeenCalled();
    expect(openModalMock).toHaveBeenCalledTimes(2);
    const reviewArgs = openModalMock.mock.calls[1][0];
    expect(reviewArgs.title).toBe("Review Request");
  });

  it("highlights duplicate requests in the warning list", () => {
    renderReceiveCard({
      requestContact: {
        id: 11,
        full_name: "Jamie Example",
      } as any,
      qrTcoinAmount: "5",
      openRequests: [
        {
          id: 22,
          amount_requested: 5,
          request_from: 11,
        } as any,
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Review Request/i }));

    const modalArgs = openModalMock.mock.calls[0][0];
    const renderedModal = render(modalArgs.content as React.ReactElement);
    expect(
      renderedModal.getByText(
        /already have 1 open request for Jamie Example/i
      )
    ).toBeTruthy();
    renderedModal.unmount();
  });

  it("hides the QR code when a request contact is selected", () => {
    renderReceiveCard({
      requestContact: {
        id: 55,
        full_name: "Riley Example",
      } as any,
      showQrCode: true,
    });

    expect(screen.queryByTestId("qr-code")).toBeNull();
    expect(
      screen.getByText(/QR code hidden while preparing a direct contact request/i)
    ).toBeTruthy();
  });

  it("creates a targeted request after confirmation", async () => {
    const requestContact = {
      id: 15,
      full_name: "Taylor Example",
    } as any;
    const onCreateTargetedRequest = vi.fn().mockResolvedValue({ id: 99 });
    const onClearRequestContact = vi.fn();

    renderReceiveCard({
      requestContact,
      qrTcoinAmount: "12",
      qrCadAmount: "$36.00",
      onCreateTargetedRequest,
      onClearRequestContact,
    });

    fireEvent.click(screen.getByRole("button", { name: /Review Request/i }));

    expect(openModalMock).toHaveBeenCalledTimes(1);
    const modalArgs = openModalMock.mock.calls[0][0];
    expect(modalArgs.title).toBe("Review Request");
    const modal = render(modalArgs.content as React.ReactElement);
    expect(
      modal.getByText(/notification.*next time they log in/i)
    ).toBeTruthy();
    const confirmButton = modal.getByRole("button", { name: /Create Request/i });

    await act(async () => {
      fireEvent.click(confirmButton);
      await Promise.resolve();
    });

    expect(onCreateTargetedRequest).toHaveBeenCalledWith(
      requestContact,
      12,
      "12.00 TCOIN"
    );
    expect(onClearRequestContact).toHaveBeenCalled();
    expect(closeModalMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Request for 12.00 TCOIN sent to Taylor Example."
    );

    modal.unmount();
  });

  it("prevents creating more than three open requests for the same contact", () => {
    const requestContact = {
      id: 21,
      full_name: "Jordan Example",
    } as any;

    renderReceiveCard({
      requestContact,
      qrTcoinAmount: "10",
      openRequests: [
        { id: 31, request_from: 21 } as any,
        { id: 32, request_from: 21 } as any,
        { id: 33, request_from: 21 } as any,
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Review Request/i }));

    expect(openModalMock).toHaveBeenCalledTimes(1);
    const modalArgs = openModalMock.mock.calls[0][0];
    expect(modalArgs.title).toBe("Resolve open requests");
    const renderedModal = render(modalArgs.content as React.ReactElement);

    expect(
      renderedModal.getByText(/You already have 3 open requests for Jordan Example/i)
    ).toBeTruthy();
    const goBackButton = renderedModal.getByRole("button", { name: /Go back/i });
    fireEvent.click(goBackButton);
    expect(closeModalMock).toHaveBeenCalled();

    renderedModal.unmount();
  });
});
