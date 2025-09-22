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
    render(<Navbar />);

    expect(screen.getByText("@testuser")).toBeTruthy();
    expect(screen.getByText("test@example.com")).toBeTruthy();
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
});
