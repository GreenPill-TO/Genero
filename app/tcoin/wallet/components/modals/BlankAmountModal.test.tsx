/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { BlankAmountModal } from "./BlankAmountModal";
import { describe, it, expect, vi } from "vitest";

vi.mock("./ContactSelectModal", () => ({
  ContactSelectModal: () => <div>contact-select</div>,
}));

describe("BlankAmountModal", () => {
  it("closes on Escape", () => {
    const closeModal = vi.fn();
    const openModal = vi.fn();
    render(<BlankAmountModal closeModal={closeModal} openModal={openModal} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeModal).toHaveBeenCalled();
  });

  it.skip("opens contact selector on confirm", () => {
    const closeModal = vi.fn();
    const openModal = vi.fn();
    const { getAllByText } = render(
      <BlankAmountModal closeModal={closeModal} openModal={openModal} />
    );
    fireEvent.click(getAllByText("Send blank request")[0]);
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Request from Contact" })
    );
  });
});
