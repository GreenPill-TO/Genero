/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ShareQrModal } from "./ShareQrModal";
import { fireEvent, render, screen } from "@testing-library/react";

describe("ShareQrModal", () => {
  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ShareQrModal closeModal={closeModal} />);
    });

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(event);
    });

    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("uses the updated TCOIN invoice copy for email sharing", () => {
    const closeModal = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ShareQrModal
        closeModal={closeModal}
        qrCodeData="https://www.tcoin.me/pay/test-token"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Share via Email/i }));

    expect(openSpy).toHaveBeenCalledWith(
      "mailto:?subject=My%20TCOIN%20Request&body=Please%20check%20out%20this%20TCOIN%20invoice%20%2F%20request%20link%3A%20https%3A%2F%2Fwww.tcoin.me%2Fpay%2Ftest-token",
      "_blank"
    );
    expect(closeModal).toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
