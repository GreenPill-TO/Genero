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

  it("redirects new users to the dashboard after sign-up", async () => {
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

    expect(push).toHaveBeenCalledWith("/welcome");
    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("returns existing users to the dashboard", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    fetchUserByContactMock.mockResolvedValue({ user: { id: 42, has_completed_intro: true }, error: null });

    act(() => {
      root.render(
        <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />
      );
    });

    await act(async () => {
      await verifySuccess?.();
    });

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("routes incomplete existing users back to welcome", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    fetchUserByContactMock.mockResolvedValue({ user: { id: 42, has_completed_intro: false }, error: null });

    act(() => {
      root.render(
        <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />
      );
    });

    await act(async () => {
      await verifySuccess?.();
    });

    expect(push).toHaveBeenCalledWith("/welcome");
    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("supports an explicit post-auth redirect override", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    fetchUserByContactMock.mockResolvedValue({ user: { id: 42, has_completed_intro: true }, error: null });

    act(() => {
      root.render(
        <SignInModal
          closeModal={closeModal}
          extraObject={{ isSignIn: true }}
          postAuthRedirect="/pay/opaque-token"
        />
      );
    });

    await act(async () => {
      await verifySuccess?.();
    });

    expect(push).toHaveBeenCalledWith("/pay/opaque-token");
    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
