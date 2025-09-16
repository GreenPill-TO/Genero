/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SendCard } from "./SendCard";

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: { cubidData: { id: 1 } } }),
}));
vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), closeModal: vi.fn() }),
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

function noop() {}

describe("SendCard", () => {
  it("disables send button when no recipient", () => {
    render(
      <SendCard
        toSendData={null}
        setToSendData={noop}
        tcoinAmount=""
        cadAmount=""
        handleTcoinChange={noop as any}
        handleCadChange={noop as any}
        handleTcoinBlur={noop}
        handleCadBlur={noop}
        explorerLink={null}
        setExplorerLink={noop}
        setTcoin={noop}
        setCad={noop}
        sendMoney={vi.fn()}
        userBalance={0}
        onUseMax={noop}
      />
    );
    const button = screen.getByRole("button", { name: /send to contact/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows available balance and triggers onUseMax", () => {
    const onUseMax = vi.fn();
    render(
      <SendCard
        toSendData={null}
        setToSendData={noop}
        tcoinAmount=""
        cadAmount=""
        handleTcoinChange={noop as any}
        handleCadChange={noop as any}
        handleTcoinBlur={noop}
        handleCadBlur={noop}
        explorerLink={null}
        setExplorerLink={noop}
        setTcoin={noop}
        setCad={noop}
        sendMoney={vi.fn()}
        userBalance={5}
        onUseMax={onUseMax}
      />
    );
    expect(screen.getByText(/available: 5.0000/i)).toBeTruthy();
    const buttons = screen.getAllByText(/use max/i);
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onUseMax).toHaveBeenCalled();
  });

  it("formats converted amount to two decimals", () => {
    render(
      <SendCard
        toSendData={null}
        setToSendData={noop}
        tcoinAmount="1.2345"
        cadAmount="2.3456"
        handleTcoinChange={noop as any}
        handleCadChange={noop as any}
        handleTcoinBlur={noop}
        handleCadBlur={noop}
        explorerLink={null}
        setExplorerLink={noop}
        setTcoin={noop}
        setCad={noop}
        sendMoney={vi.fn()}
        userBalance={5}
        onUseMax={noop}
      />
    );
    expect(screen.getByText("≈ $2.35 CAD")).toBeTruthy();
  });

  it("shows formatted primary amount when not focused", () => {
    render(
      <SendCard
        toSendData={null}
        setToSendData={noop}
        tcoinAmount="1.2"
        cadAmount=""
        handleTcoinChange={noop as any}
        handleCadChange={noop as any}
        handleTcoinBlur={noop}
        handleCadBlur={noop}
        explorerLink={null}
        setExplorerLink={noop}
        setTcoin={noop}
        setCad={noop}
        sendMoney={vi.fn()}
        userBalance={5}
        onUseMax={noop}
      />
    );
    expect(screen.getByDisplayValue("1.20 TCOIN")).toBeTruthy();
  });
});
