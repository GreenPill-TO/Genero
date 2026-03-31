/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

const openModal = vi.fn();
const closeModal = vi.fn();
const signOut = vi.fn();

const useAuthMock = vi.fn();

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal }),
}));

vi.mock("@shared/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("./ThemeToggleButton", () => ({
  ThemeToggleButton: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
  QrScanModal: () => <div data-testid="qr-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/UserProfileModal", () => ({
  UserProfileModal: () => <div data-testid="profile-modal" />,
}));

vi.mock("@tcoin/wallet/components/modals/SignInModal", () => ({
  __esModule: true,
  default: () => <div data-testid="sign-in" />,
}));

describe("Navbar session control", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      userData: {
        cubidData: {
          username: "testuser",
          email: "test@example.com",
          profile_image_url: null,
        },
        user: {
          email: "test@example.com",
        },
      },
      signOut,
    });
  });

  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    signOut.mockReset();
  });

  it("shows the session dropdown with user details", () => {
    const { container } = render(<Navbar />);
    const nav = container.querySelector("nav");

    expect(nav?.className).toContain("font-sans");
    expect(screen.getByText("@testuser")).toBeTruthy();
    expect(screen.getAllByText("test@example.com")).toHaveLength(2);
  });

  it("opens the edit profile modal from the dropdown", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Edit Profile");
  });

  it("logs the user out from the dropdown", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Log Out/i }));

    expect(signOut).toHaveBeenCalled();
  });

  it("opens a large responsive QR scanner modal from the camera button", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /open qr scanner/i }));

    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Scan QR");
    expect(openModal.mock.calls[0][0].elSize).toBe("4xl");
    expect(openModal.mock.calls[0][0].isResponsive).toBe(true);
  });

  it("stays visible on desktop when hide-header is dispatched", () => {
    const { container } = render(<Navbar />);
    const nav = container.querySelector("nav");

    document.dispatchEvent(new Event("hide-header"));

    expect(nav?.className).toContain("translate-y-0");
    expect(nav?.className).not.toContain("-translate-y-full");
  });

  it("stays visible on desktop scroll", () => {
    const { container } = render(<Navbar />);
    const nav = container.querySelector("nav");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 220,
    });

    fireEvent.scroll(window);

    expect(nav?.className).toContain("translate-y-0");
    expect(nav?.className).not.toContain("-translate-y-full");
  });

  it("hides on phone-sized screens when hide-header is dispatched", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    const { container } = render(<Navbar />);
    const nav = container.querySelector("nav");

    fireEvent(document, new Event("hide-header"));

    expect(nav?.className).toContain("-translate-y-full");
  });
});
