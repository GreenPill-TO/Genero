/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

const openModal = vi.fn();
const closeModal = vi.fn();
const signOut = vi.fn();
const useCameraAvailabilityMock = vi.fn();

const useAuthMock = vi.fn();
const useUserSettingsMock = vi.fn();
const toastInfo = vi.fn();

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal, closeModal }),
}));

vi.mock("@shared/components/ui/Avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <div role="img" aria-label={alt} data-src={src} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock("react-toastify", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("@shared/hooks/useCameraAvailability", () => ({
  useCameraAvailability: () => useCameraAvailabilityMock(),
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
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "development";
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
          nickname: "Tester",
          given_names: "Test",
        },
        user: {
          email: "test@example.com",
        },
      },
      signOut,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: {
        user: {
          nickname: "Tester",
          firstName: "Test",
          fullName: "Test User",
          username: "testuser",
          email: "test@example.com",
          profileImageUrl: "https://example.com/avatar.png",
        },
        preferences: {
          experienceMode: "advanced",
        },
      },
    });
    useCameraAvailabilityMock.mockReturnValue({
      hasCamera: true,
      hasMultipleCameras: true,
      isCheckingCamera: false,
    });
  });

  afterEach(() => {
    cleanup();
    openModal.mockReset();
    closeModal.mockReset();
    signOut.mockReset();
    toastInfo.mockReset();
    useUserSettingsMock.mockReset();
  });

  it("shows the session dropdown with preferred name, email, and profile picture", () => {
    const { container } = render(<Navbar />);
    const nav = container.querySelector("nav");

    expect(nav?.className).toContain("font-sans");
    expect(screen.getAllByText("Tester")).toHaveLength(2);
    expect(screen.getAllByText("test@example.com")).toHaveLength(2);
    const avatarImages = screen.getAllByRole("img", { name: /avatar/i });
    expect(avatarImages.some((image) => image.getAttribute("data-src")?.includes("https://example.com/avatar.png"))).toBe(
      true
    );
  });

  it("opens the edit profile modal from the dropdown", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));

    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Edit Profile");
    expect(openModal.mock.calls[0][0].elSize).toBe("5xl");
    expect(openModal.mock.calls[0][0].isResponsive).toBe(true);
  });

  it("opens the experience-mode modal from the dropdown", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Experience mode/i }));

    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Experience mode");
  });

  it("logs the user out from the dropdown", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Log Out/i }));

    expect(signOut).toHaveBeenCalled();
  });

  it("shows the delete-profile action outside production and explains that it is not wired yet", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /Delete this profile/i }));

    expect(toastInfo).toHaveBeenCalledWith("Profile deletion is not wired yet in this environment.");
  });

  it("hides the delete-profile action in production", () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "production";

    render(<Navbar />);

    expect(screen.queryByRole("button", { name: /Delete this profile/i })).toBeNull();
  });

  it("opens a large responsive QR scanner modal from the camera button", () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /open qr scanner/i }));

    expect(openModal).toHaveBeenCalled();
    expect(openModal.mock.calls[0][0].title).toBe("Scan QR");
    expect(openModal.mock.calls[0][0].elSize).toBe("4xl");
    expect(openModal.mock.calls[0][0].isResponsive).toBe(true);
  });

  it("hides the camera button when the device reports no camera", () => {
    useCameraAvailabilityMock.mockReturnValue({
      hasCamera: false,
      hasMultipleCameras: false,
      isCheckingCamera: false,
    });

    render(<Navbar />);

    expect(screen.queryByRole("button", { name: /open qr scanner/i })).toBeNull();
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
