/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { CharitySelectModal } from "./CharitySelectModal";

describe("CharitySelectModal", () => {
  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const setSelectedCharity = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <CharitySelectModal
          closeModal={closeModal}
          selectedCharity="The FoodBank"
          setSelectedCharity={setSelectedCharity}
        />
      );
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
});

