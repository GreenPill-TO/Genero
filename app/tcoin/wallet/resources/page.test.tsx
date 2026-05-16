/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));
vi.mock("@tcoin/wallet/components/landing-header", () => ({
  LandingHeader: () => <div data-testid="landing-header" />,
}));
vi.mock("@tcoin/wallet/components/footer", () => ({
  Footer: () => <div data-testid="landing-footer" />,
}));

import ResourcesPage from "./page";

describe("ResourcesPage", () => {
  it("keeps resource hyperlinks scoped to the shortest useful phrases", () => {
    render(<ResourcesPage />);

    expect(
      screen.getByRole("link", { name: "this hackathon submission" }).getAttribute("href")
    ).toBe("https://dorahacks.io/buidl/14336");
    expect(screen.queryByRole("link", { name: /Find out more about the details/i })).toBeNull();

    expect(screen.getByRole("link", { name: "this Whitepaper" }).getAttribute("href")).toContain(
      "docs.google.com/document"
    );
    expect(screen.getByRole("link", { name: "the presentation here" }).getAttribute("href")).toContain(
      "drive.google.com/file"
    );
    expect(screen.getByRole("link", { name: "on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/GreenPill-TO/TorontoCoin"
    );
    expect(
      screen.getByRole("link", { name: "the projects in our wider network" }).getAttribute("href")
    ).toBe("/ecosystem");
  });
});
