/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendCard, calculateResponsiveFontSize } from "./SendCard";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("react-toastify", () => ({ toast: toastMock }));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: { cubidData: { id: 1 } } }),
}));
const openModalMock = vi.fn();
vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: openModalMock, closeModal: vi.fn() }),
}));
vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        match: () => ({
          neq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));
const insertSuccessNotificationMock = vi.hoisted(() => vi.fn());
vi.mock("@shared/utils/insertNotification", () => ({
  insertSuccessNotification: insertSuccessNotificationMock,
}));

const createProps = () => ({
  toSendData: null as any,
  setToSendData: vi.fn(),
  tcoinAmount: "",
  cadAmount: "",
  handleTcoinChange: vi.fn(),
  handleCadChange: vi.fn(),
  handleTcoinBlur: vi.fn(),
  handleCadBlur: vi.fn(),
  explorerLink: null as string | null,
  setExplorerLink: vi.fn(),
  sendMoney: vi.fn(),
  userBalance: 0,
  onUseMax: vi.fn(),
  contacts: [],
});

const renderSendCard = (overrides: Partial<ReturnType<typeof createProps>> = {}) => {
  const props = { ...createProps(), ...overrides };
  return render(<SendCard {...(props as any)} />);
};

describe("SendCard", () => {
  beforeEach(() => {
    openModalMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    insertSuccessNotificationMock.mockReset();
    Object.values(toastMock).forEach((fn) => fn.mockReset());
    vi.useRealTimers();
  });

  it("disables send button when no recipient", () => {
    renderSendCard();
    const button = screen.getByRole("button", { name: "Send..." }) as HTMLButtonElement;
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows available balance and triggers onUseMax", () => {
    const onUseMax = vi.fn();
    renderSendCard({ userBalance: 5, onUseMax });
    expect(screen.getByText(/available: 5.0000/i)).toBeTruthy();
    const buttons = screen.getAllByText(/use max/i);
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onUseMax).toHaveBeenCalled();
  });

  it("formats converted amount to two decimals", () => {
    renderSendCard({ tcoinAmount: "1.2345", cadAmount: "2.3456" });
    expect(screen.getByText("≈ $2.35 CAD")).toBeTruthy();
  });

  it("shows formatted primary amount when not focused", () => {
    renderSendCard({ tcoinAmount: "1.2" });
    expect(screen.getByDisplayValue("1.20 TCOIN")).toBeTruthy();
  });

  it("shows the select contact button when no recipient is chosen", () => {
    renderSendCard();
    const selectButtons = screen.getAllByRole("button", { name: /Select Contact/i });
    expect(selectButtons.length).toBeGreaterThan(0);
  });

  it("focuses the amount input on mount", () => {
    vi.useFakeTimers();
    renderSendCard();
    vi.runAllTimers();
    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;
    expect(document.activeElement).toBe(amountInput);
  });

  it("moves focus to the recipient field after entering a non-zero amount and pressing enter", () => {
    vi.useFakeTimers();
    renderSendCard({ tcoinAmount: "5.00" });
    vi.runAllTimers();
    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;
    const recipientInput = screen.getByPlaceholderText("Start typing a name") as HTMLInputElement;

    amountInput.focus();
    fireEvent.keyDown(amountInput, { key: "Enter", code: "Enter" });

    expect(document.activeElement).toBe(recipientInput);
  });

  it("focuses the send button when tabbing from the amount field with a recipient", () => {
    const sendButtonProps = {
      toSendData: { id: 2, full_name: "Recipient" } as any,
      tcoinAmount: "0.00",
    };
    renderSendCard(sendButtonProps);
    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;
    const sendButton = screen.getByRole("button", { name: "Send..." }) as HTMLButtonElement;

    amountInput.focus();
    fireEvent.keyDown(amountInput, { key: "Tab" });

    expect(document.activeElement).toBe(sendButton);
  });

  it("focuses the send button when pressing enter from the amount field with a recipient", () => {
    renderSendCard({
      toSendData: { id: 3, full_name: "Recipient" } as any,
      tcoinAmount: "0.00",
    });

    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;
    const sendButton = screen.getByRole("button", { name: "Send..." }) as HTMLButtonElement;

    amountInput.focus();
    fireEvent.keyDown(amountInput, { key: "Enter", code: "Enter" });

    expect(document.activeElement).toBe(sendButton);
  });

  it("returns focus to the amount field when a recipient is selected without an amount", () => {
    vi.useFakeTimers();
    const baseProps = createProps();

    const { rerender } = render(<SendCard {...(baseProps as any)} />);

    vi.runAllTimers();

    rerender(
      <SendCard
        {...(baseProps as any)}
        toSendData={{ id: 4, full_name: "Recipient" } as any}
        tcoinAmount="0"
        cadAmount=""
      />
    );

    vi.runAllTimers();

    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;

    expect(document.activeElement).toBe(amountInput);
  });

  it("focuses the send button after selecting a recipient when an amount exists", () => {
    vi.useFakeTimers();
    const baseProps = createProps();

    const { rerender } = render(<SendCard {...(baseProps as any)} />);

    vi.runAllTimers();

    rerender(
      <SendCard
        {...(baseProps as any)}
        toSendData={{ id: 5, full_name: "Recipient" } as any}
        tcoinAmount="10"
        cadAmount=""
      />
    );

    vi.runAllTimers();

    const sendButton = screen.getByRole("button", { name: "Send..." }) as HTMLButtonElement;

    expect(document.activeElement).toBe(sendButton);
  });

  it("shows contact suggestions when typing in the recipient field", () => {
    const setToSendData = vi.fn();
    renderSendCard({
      contacts: [
        {
          id: 1,
          full_name: "Alice Johnson",
          username: "alice",
          profile_image_url: null,
          wallet_address: null,
          state: null,
          last_interaction: null,
        },
        {
          id: 2,
          full_name: "Bob Smith",
          username: null,
          profile_image_url: null,
          wallet_address: null,
          state: null,
          last_interaction: null,
        },
      ],
      setToSendData,
    });

    const recipientInput = screen.getByPlaceholderText("Start typing a name") as HTMLInputElement;
    fireEvent.change(recipientInput, { target: { value: "ali" } });

    const suggestionButton = screen.getByRole("button", { name: /Alice Johnson/i });
    fireEvent.click(suggestionButton);

    expect(setToSendData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, full_name: "Alice Johnson" })
    );
  });

  it("clears the selected recipient when the clear button is pressed", () => {
    const setToSendData = vi.fn();
    renderSendCard({
      toSendData: {
        id: 42,
        full_name: "Recipient",
        username: "recipient",
        profile_image_url: null,
        wallet_address: null,
        state: "accepted",
      } as any,
      setToSendData,
    });

    fireEvent.click(screen.getByRole("button", { name: /clear recipient/i }));
    expect(setToSendData).toHaveBeenCalledWith(null);
  });

  it("opens the contact selector modal when Select Contact is clicked", () => {
    renderSendCard();
    const buttons = screen.getAllByRole("button", { name: /Select Contact/i });
    fireEvent.click(buttons[0]);
    expect(openModalMock).toHaveBeenCalled();
  });

  it("does not render the clear recipient button when locked", () => {
    renderSendCard({
      toSendData: { id: 99, full_name: "Recipient" } as any,
      locked: true,
    });

    expect(
      screen.queryByRole("button", { name: /clear recipient/i })
    ).toBeNull();
  });

  it("allows editing the amount when lockAmount is false", () => {
    renderSendCard({
      locked: true,
      lockRecipient: true,
      lockAmount: false,
      tcoinAmount: "0.00",
    });

    const amountInput = screen.getAllByLabelText("Amount in TCOIN")[0] as HTMLInputElement;
    expect(amountInput.readOnly).toBe(false);
  });

  it("renders a custom recipient heading when provided", () => {
    renderSendCard({ recipientHeading: "Requested By:" });
    expect(screen.getByText("Requested By:")).toBeTruthy();
  });

  it("enables the send button when amount and recipient are set", () => {
    renderSendCard({
      tcoinAmount: "1.00",
      cadAmount: "1.00",
      toSendData: { id: 1, full_name: "Test" } as any,
    });

    const sendButtons = screen.getAllByRole("button", { name: "Send..." }) as HTMLButtonElement[];
    expect(
      sendButtons.some((btn) => btn.getAttribute("aria-disabled") === "false")
    ).toBe(true);
  });

  it("uses the provided action label on the send button", () => {
    renderSendCard({ actionLabel: "Pay this request" });

    expect(
      screen.getByRole("button", { name: /Pay this request/i })
    ).toBeTruthy();
  });

  it("records notifications and surfaces a single success toast after confirming", async () => {
    const sendMoney = vi.fn().mockResolvedValue("0xhash");
    const setExplorerLink = vi.fn();
    const onPaymentComplete = vi.fn();

    renderSendCard({
      sendMoney,
      setExplorerLink,
      onPaymentComplete,
      toSendData: { id: 7, full_name: "Jordan" } as any,
      tcoinAmount: "5.00",
      cadAmount: "15.00",
      userBalance: 25,
    });

    fireEvent.click(screen.getByRole("button", { name: "Send..." }));

    const modalContent = openModalMock.mock.calls[0][0].content as React.ReactElement;
    render(modalContent);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(sendMoney).toHaveBeenCalledWith("5.00"));
    await waitFor(() => expect(insertSuccessNotificationMock).toHaveBeenCalledTimes(2));
    insertSuccessNotificationMock.mock.calls.forEach(([payload]) => {
      expect(payload).toMatchObject({ showToast: false });
    });
    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalled());
    expect(setExplorerLink).toHaveBeenCalledWith("https://evm-testnet.flowscan.io/tx/0xhash");
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success.mock.calls[0][0]).toContain("Sent 5.00 TCOIN");
  });

  it("shows the underlying error when sending fails", async () => {
    const sendMoney = vi.fn().mockRejectedValue(new Error("Recipient wallet address not found."));
    const setExplorerLink = vi.fn();

    renderSendCard({
      sendMoney,
      setExplorerLink,
      toSendData: { id: 11, full_name: "Morgan" } as any,
      tcoinAmount: "3.00",
      cadAmount: "9.00",
      userBalance: 25,
    });

    fireEvent.click(screen.getByRole("button", { name: "Send..." }));
    const modalContent = openModalMock.mock.calls[0][0].content as React.ReactElement;
    render(modalContent);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(sendMoney).toHaveBeenCalledWith("3.00"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Recipient wallet address not found.")
    );
    expect(setExplorerLink).toHaveBeenCalledWith(null);
    expect(insertSuccessNotificationMock).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe("calculateResponsiveFontSize", () => {
  it("returns the max size for short values", () => {
    expect(calculateResponsiveFontSize("123")).toBe("min(4.50rem, 12vw)");
  });

  it("shrinks the size for longer values", () => {
    expect(calculateResponsiveFontSize("123456789012")).toBe("min(2.10rem, 12vw)");
  });

  it("caps the size at the minimum for very long values", () => {
    expect(calculateResponsiveFontSize("12345678901234567890")).toBe("min(1.10rem, 12vw)");
  });
});
