/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("applies the wallet auth theme classes when provided", () => {
    const { container } = render(
      <Modal
        modalContent={{
          title: "Wallet modal",
          description: "Signed-in modal chrome",
          content: <div>Body</div>,
          elSize: "md",
        }}
        closeModal={vi.fn()}
        modalThemeClassName="wallet-auth-shell font-sans"
      />
    );

    const modalRoot = container.firstElementChild as HTMLElement;
    expect(modalRoot.className).toContain("wallet-auth-shell");
    expect(modalRoot.className).toContain("font-sans");
    expect(screen.getByText("Wallet modal").className).toContain("font-sans");
    expect(screen.getByRole("button", { name: "✕" }).className).toContain("font-sans");
  });
});
