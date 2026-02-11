/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openModal = vi.fn();
const closeModal = vi.fn();
const pushMock = vi.fn();

const useAuthMock = vi.hoisted(() =>
  vi.fn(() => ({
    isAuthenticated: false,
  }))
);

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("@tcoin/wallet/components/modals/SignInModal", () => ({
  default: () => <div data-testid="sign-in-modal" />,
}));

import { LandingHeader } from "./LandingHeader";

describe("LandingHeader", () => {
  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    pushMock.mockReset();
  });

  it("shows mobile summary content without hamburger when requested", () => {
    render(<LandingHeader showMobileSummary />);

    expect(screen.getByText("Local Currency.")).toBeTruthy();
    expect(screen.getByText("Value = $3.35.")).toBeTruthy();
    expect(screen.getByText("Proceeds to charity.")).toBeTruthy();
    expect(screen.getAllByText("<open my wallet>").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /open menu/i })).toBeNull();
  });

  it("opens sign-in modal from mobile summary button when unauthenticated", () => {
    render(<LandingHeader showMobileSummary />);

    fireEvent.click(screen.getAllByText("<open my wallet>")[0]);

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
