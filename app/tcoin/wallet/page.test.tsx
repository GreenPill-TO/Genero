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

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tcoin/wallet/components/modals/SignInModal", () => ({
  default: () => <div data-testid="sign-in-modal" />,
}));

vi.mock("@tcoin/wallet/components/landing-header", () => ({
  LandingHeader: () => <div data-testid="landing-header" />,
}));

vi.mock("@tcoin/wallet/components/footer", () => ({
  Footer: () => <div data-testid="landing-footer" />,
}));

import HomePage from "./page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    pushMock.mockReset();
  });

  it("renders the mobile summary stack in the body for unauthenticated users", () => {
    render(<HomePage />);

    expect(screen.getByText("Local Currency.")).toBeTruthy();
    expect(screen.getByText("Value = $3.35.")).toBeTruthy();
    expect(screen.getByText("Proceeds to charity.")).toBeTruthy();
  });


  it("applies dark-mode gradient shell and heading contrast classes", () => {
    const { container } = render(<HomePage />);
    const shell = container.firstElementChild as HTMLElement | null;
    const heading = screen.getByRole("heading", { name: "The future of money is local" });

    expect(shell?.className).toContain("dark:bg-gradient-to-b");
    expect(shell?.className).toContain("dark:text-gray-200");
    expect(heading.className).toContain("dark:text-white");
  });

  it("opens sign-in modal from the body summary CTA when unauthenticated", () => {
    render(<HomePage />);

    const walletLinks = screen.getAllByRole("link", { name: "<open my wallet>" });
    fireEvent.click(walletLinks[0]);

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
