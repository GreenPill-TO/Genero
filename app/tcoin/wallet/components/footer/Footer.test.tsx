/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));

describe("Footer", () => {
  afterEach(() => {
    cleanup();
  });
  it("includes ecosystem link", () => {
    const { getByText } = render(<Footer />);
    const link = getByText("Ecosystem");
    expect(link.getAttribute("href")).toBe("/ecosystem");
  });

  it("renders the requested 2026 copyright label", () => {
    render(<Footer />);
    expect(screen.getByText("© 2026 Toronto Coin. All rights reserved.")).toBeTruthy();
  });
});
