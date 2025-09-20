/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendCard, calculateResponsiveFontSize } from "./SendCard";

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
vi.mock("@shared/utils/insertNotification", () => ({ insertSuccessNotification: vi.fn() }));

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
    vi.useRealTimers();
  });

  it("disables send button when no recipient", () => {
    renderSendCard();
    const button = screen.getByRole("button", { name: "Send..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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

  it("enables the send button when amount and recipient are set", () => {
    renderSendCard({
      tcoinAmount: "1.00",
      cadAmount: "1.00",
      toSendData: { id: 1, full_name: "Test" } as any,
    });

    const sendButtons = screen.getAllByRole("button", { name: "Send..." }) as HTMLButtonElement[];
    expect(sendButtons.some((btn) => btn.disabled === false)).toBe(true);
  });
});

describe("calculateResponsiveFontSize", () => {
  it("returns the max size for short values", () => {
    expect(calculateResponsiveFontSize("123")).toBe("min(4.50rem, 12vw)");
  });

  it("shrinks the size for longer values", () => {
    expect(calculateResponsiveFontSize("123456789012")).toBe("min(2.75rem, 12vw)");
  });

  it("caps the size at the minimum for very long values", () => {
    expect(calculateResponsiveFontSize("12345678901234567890")).toBe("min(1.75rem, 12vw)");
  });
});
