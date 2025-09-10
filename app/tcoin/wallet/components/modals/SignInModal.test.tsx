/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import SignInModal from "./SignInModal";

vi.mock("@shared/api/mutations/usePasscode", () => ({
  useSendPasscodeMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyPasscodeMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@shared/components/ui/ImageCarousel", () => ({
  __esModule: true,
  default: () => <div />,
}));

vi.mock("@tcoin/sparechange/components/forms/OTPForm", () => ({
  __esModule: true,
  default: (props: any) => <form onSubmit={props.onSubmit}></form>,
}));

vi.mock("@shared/api/services/cubidService", () => ({ createCubidUser: vi.fn() }));
vi.mock("@shared/api/services/supabaseService", () => ({
  createNewUser: vi.fn(),
  fetchUserByContact: vi.fn().mockResolvedValue({ user: null, error: null }),
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("SignInModal", () => {
  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />);
    });

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);
    });

    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
