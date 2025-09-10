import { fireEvent, render } from "@testing-library/react";
import { BlankAmountModal } from "./BlankAmountModal";
import { vi } from "vitest";

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

  it("opens contact selector on confirm", () => {
    const closeModal = vi.fn();
    const openModal = vi.fn();
    const { getByText } = render(<BlankAmountModal closeModal={closeModal} openModal={openModal} />);
    fireEvent.click(getByText("Send blank request"));
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Request from Contact" })
    );
  });
});
