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

  it("renders the header wallet CTA link and no hamburger menu button", () => {
    render(<LandingHeader />);

    expect(screen.getByRole("link", { name: "<open my wallet>" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open menu/i })).toBeNull();
  });


  it("renders a gradient fade strip below the fixed header", () => {
    const { container } = render(<LandingHeader />);
    expect(container.querySelector('.bg-gradient-to-b')).toBeTruthy();
  });

  it("opens sign-in modal from the header wallet button when unauthenticated", () => {
    render(<LandingHeader />);

    fireEvent.click(screen.getByRole("link", { name: "<open my wallet>" }));

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
