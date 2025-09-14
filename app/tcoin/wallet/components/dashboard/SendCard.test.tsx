/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
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
        explorerLink={null}
        setExplorerLink={noop}
        setTcoin={noop}
        setCad={noop}
        sendMoney={vi.fn()}
        userBalance={0}
      />
    );
    const button = screen.getByRole("button", { name: /send to contact/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
