/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));
const mockToggleDarkMode = vi.fn();
const mockUseDarkMode = vi.fn(() => ({ isDarkMode: false, toggleDarkMode: mockToggleDarkMode }));
vi.mock("@shared/hooks/useDarkMode", () => ({ default: () => mockUseDarkMode() }));

describe("Footer", () => {
  afterEach(() => {
    cleanup();
    mockToggleDarkMode.mockReset();
    mockUseDarkMode.mockReset();
    mockUseDarkMode.mockReturnValue({ isDarkMode: false, toggleDarkMode: mockToggleDarkMode });
  });
  it("includes ecosystem link", () => {
    const { getByText } = render(<Footer />);
    const link = getByText("Ecosystem");
    expect(link.getAttribute("href")).toBe("/ecosystem");
  });

  it("opens github link in a new tab", () => {
    render(<Footer />);
    const link = screen.getByText("Github");
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
    mockUseDarkMode.mockReturnValue({ isDarkMode: true, toggleDarkMode: mockToggleDarkMode });
    render(<Footer />);
    expect(screen.getByText("Light Mode")).toBeTruthy();
  });

  it("renders the requested 2026 copyright label", () => {
    render(<Footer />);
    expect(screen.getByText("© 2026 Toronto Coin. All rights reserved.")).toBeTruthy();
  });
});
