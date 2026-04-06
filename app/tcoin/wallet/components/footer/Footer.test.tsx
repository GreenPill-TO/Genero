/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));
const mockMutateAsync = vi.fn();
const mockSetThemeOverride = vi.fn();
const mockUseDarkMode = vi.fn(() => ({ isDarkMode: false, setThemeOverride: mockSetThemeOverride }));
vi.mock("@shared/hooks/useDarkMode", () => ({ default: () => mockUseDarkMode() }));
vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    bootstrap: null,
  }),
}));
vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useUpdateUserPreferencesMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe("Footer", () => {
  afterEach(() => {
    cleanup();
    mockSetThemeOverride.mockReset();
    mockMutateAsync.mockReset();
    mockUseDarkMode.mockReset();
    mockUseDarkMode.mockReturnValue({ isDarkMode: false, setThemeOverride: mockSetThemeOverride });
  });
  it("includes ecosystem link", () => {
    const { getByText } = render(<Footer />);
    const link = getByText("Ecosystem");
    expect(link.getAttribute("href")).toBe("/ecosystem");
  });

  it("includes merchants link", () => {
    const { getByText } = render(<Footer />);
    const link = getByText("Merchants");
    expect(link.getAttribute("href")).toBe("/merchants");
  });

  it("opens github link in a new tab", () => {
    render(<Footer />);
    const link = screen.getByText("GitHub");
    expect(link.getAttribute("href")).toBe("https://github.com/GreenPill-TO/TorontoCoin");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });


  it("uses base font size for footer links", () => {
    const { getByText } = render(<Footer />);
    const linksContainer = getByText("Resources").parentElement;
    expect(linksContainer?.className).toContain("text-base");
  });

  it("shows dark mode switch text when theme is light", () => {
    render(<Footer />);
    expect(screen.getByText("Dark Mode")).toBeTruthy();
  });

  it("shows light mode switch text when theme is dark", () => {
    mockUseDarkMode.mockReturnValue({ isDarkMode: true, setThemeOverride: mockSetThemeOverride });
    render(<Footer />);
    expect(screen.getByText("Light Mode")).toBeTruthy();
  });

  it("offers dark mode when the resolved system-following state is currently light", () => {
    mockUseDarkMode.mockReturnValue({
      isDarkMode: false,
      isFollowingSystem: true,
      themeMode: "system",
      setThemeOverride: mockSetThemeOverride,
    });
    render(<Footer />);
    expect(screen.getByText("Dark Mode")).toBeTruthy();
  });

  it("renders the requested 2026 copyright label", () => {
    render(<Footer />);
    expect(screen.getByText("© 2026 Toronto Coin. All rights reserved.")).toBeTruthy();
  });
});
