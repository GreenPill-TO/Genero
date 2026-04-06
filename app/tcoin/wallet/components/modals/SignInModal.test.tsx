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

const { fetchUserByContactMock, waitForAuthenticatedSessionMock } = vi.hoisted(() => ({
  fetchUserByContactMock: vi.fn().mockResolvedValue({ user: null, error: null }),
  waitForAuthenticatedSessionMock: vi.fn().mockResolvedValue({ access_token: "access-token" }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchUserByContact: fetchUserByContactMock,
  waitForAuthenticatedSession: waitForAuthenticatedSessionMock,
}));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("SignInModal", () => {
  beforeEach(() => {
    fetchUserByContactMock.mockReset();
    fetchUserByContactMock.mockResolvedValue({ user: null, error: null });
    waitForAuthenticatedSessionMock.mockReset();
    waitForAuthenticatedSessionMock.mockResolvedValue({ access_token: "access-token" });
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

  it("routes newly provisioned users to welcome", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    fetchUserByContactMock.mockResolvedValue({ user: { id: 42, has_completed_intro: false }, error: null });

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

  it("stops and keeps the modal open when the authenticated session never settles", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    waitForAuthenticatedSessionMock.mockResolvedValue(null);

    act(() => {
      root.render(<SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />);
    });

    await act(async () => {
      await verifySuccess?.();
    });

    expect(fetchUserByContactMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
