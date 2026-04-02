/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useUserSettingsMock = vi.hoisted(() => vi.fn());
const resolvePaymentRequestLinkMock = vi.hoisted(() => vi.fn());
const savePendingPaymentIntentMutateAsyncMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const openModalMock = vi.hoisted(() => vi.fn());
const closeModalMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useSavePendingPaymentIntentMutation: () => ({
    mutateAsync: savePendingPaymentIntentMutateAsyncMock,
  }),
}));

vi.mock("@shared/lib/edge/paymentRequestLinksClient", () => ({
  resolvePaymentRequestLink: resolvePaymentRequestLinkMock,
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: openModalMock, closeModal: closeModalMock }),
}));

vi.mock("@tcoin/wallet/components/landing-header", () => ({
  LandingHeader: () => <div>landing-header</div>,
}));

vi.mock("@tcoin/wallet/components/footer", () => ({
  Footer: () => <div>footer</div>,
}));

vi.mock("@tcoin/wallet/components/modals/SignInModal", () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="sign-in-modal">{props.postAuthRedirect}</div>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "opaque-token" }),
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import WalletPayPage from "./page";

const readyLink = {
  token: "opaque-token",
  state: "ready" as const,
  mode: "rotating_multi_use" as const,
  amountRequested: 13.1,
  expiresAt: "2026-04-02T12:00:00.000Z",
  consumedAt: null,
  url: "https://www.tcoin.me/pay/opaque-token",
  recipient: {
    id: 42,
    fullName: "Taylor Example",
    username: "tay",
    profileImageUrl: null,
    walletAddress: "0xwallet",
    userIdentifier: "taylor-example",
  },
};

describe("WalletPayPage", () => {
  beforeEach(() => {
    cleanup();
    replaceMock.mockReset();
    openModalMock.mockReset();
    closeModalMock.mockReset();
    savePendingPaymentIntentMutateAsyncMock.mockReset();
    savePendingPaymentIntentMutateAsyncMock.mockResolvedValue({});
    resolvePaymentRequestLinkMock.mockResolvedValue({ link: readyLink });
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a public sign-in prompt for unauthenticated users", async () => {
    render(<WalletPayPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(resolvePaymentRequestLinkMock).toHaveBeenCalledWith("opaque-token");
    expect(screen.getByText("Taylor Example")).toBeTruthy();
    expect(screen.getByText("13.10 TCOIN")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Authenticate to pay/i }));

    expect(openModalMock).toHaveBeenCalled();
    const modalArgs = openModalMock.mock.calls[0][0];
    expect(modalArgs.elSize).toBe("4xl");
  });

  it("redirects authenticated completed users into send with the payment link token", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        user: { id: 9 },
        signup: { state: "completed" },
      },
      isLoading: false,
    });

    render(<WalletPayPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(replaceMock).toHaveBeenCalledWith("/dashboard?tab=send&paymentLink=opaque-token");
  });

  it("persists a pending payment intent for incomplete users and sends them to welcome", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        user: { id: 9 },
        signup: { state: "none" },
      },
      isLoading: false,
    });

    render(<WalletPayPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(savePendingPaymentIntentMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 42,
        recipientName: "Taylor Example",
        sourceToken: "opaque-token",
        sourceMode: "rotating_multi_use",
        amountRequested: 13.1,
      })
    );
    expect(replaceMock).toHaveBeenCalledWith("/welcome");
  });

  it("shows stable copy for expired links", async () => {
    resolvePaymentRequestLinkMock.mockResolvedValue({
      link: {
        ...readyLink,
        state: "expired",
      },
    });

    render(<WalletPayPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("This pay link has expired")).toBeTruthy();
    expect(screen.getByText(/generate a fresh QR code/i)).toBeTruthy();
  });
});
