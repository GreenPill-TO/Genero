/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { TopUpModal } from "./TopUpModal";
import { describe, expect, it, vi } from "vitest";

describe("TopUpModal", () => {
  it("closes on Escape", () => {
    const closeModal = vi.fn();
    render(<TopUpModal closeModal={closeModal} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeModal).toHaveBeenCalled();
  });
});
