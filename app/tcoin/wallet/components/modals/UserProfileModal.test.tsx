/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { UserProfileModal } from "./UserProfileModal";

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    userData: {
      cubidData: { profile_image_url: null, full_name: "Test User", email: "test@example.com" },
    },
  }),
}));

describe("UserProfileModal", () => {
  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<UserProfileModal closeModal={closeModal} />);
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

