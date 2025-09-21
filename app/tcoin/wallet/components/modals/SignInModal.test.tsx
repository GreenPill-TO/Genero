/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import SignInModal from "./SignInModal";

let verifySuccess: (() => void) | null = null;
vi.mock("@shared/api/mutations/usePasscode", () => ({
  useSendPasscodeMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyPasscodeMutation: (args: any) => {
    verifySuccess = args.onSuccessCallback;
    return { mutate: vi.fn(), isPending: false };
  },
}));

vi.mock("@shared/components/ui/ImageCarousel", () => ({
  __esModule: true,
  default: () => <div />,
}));

vi.mock("@tcoin/wallet/components/forms/OTPForm", () => ({
  __esModule: true,
  default: (props: any) => <form onSubmit={props.onSubmit}></form>,
}));

const { createNewUserMock, fetchUserByContactMock } = vi.hoisted(() => ({
  createNewUserMock: vi.fn().mockResolvedValue({ error: null }),
  fetchUserByContactMock: vi.fn().mockResolvedValue({ user: null, error: null }),
}));

vi.mock("@shared/api/services/cubidService", () => ({ createCubidUser: vi.fn().mockResolvedValue("uuid") }));
vi.mock("@shared/api/services/supabaseService", () => ({
  createNewUser: createNewUserMock,
  fetchUserByContact: fetchUserByContactMock,
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("SignInModal", () => {
  beforeEach(() => {
    fetchUserByContactMock.mockResolvedValue({ user: null, error: null });
    push.mockReset();
  });

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
      document.dispatchEvent(event);
    });

    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("redirects new users to the welcome flow", async () => {
    vi.useFakeTimers();
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />);
    });

    await act(async () => {
      await verifySuccess?.();
    });
    vi.runAllTimers();

    expect(push).toHaveBeenCalledWith("/welcome");

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  it("returns existing users to the dashboard", async () => {
    vi.useFakeTimers();
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    fetchUserByContactMock.mockResolvedValue({ user: { id: 42 }, error: null });

    act(() => {
      root.render(
        <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />
      );
    });

    await act(async () => {
      await verifySuccess?.();
    });
    vi.runAllTimers();

    expect(push).toHaveBeenCalledWith("/dashboard");

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.useRealTimers();
  });
});
