/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

// Mock next/link to render anchor
vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));

describe("Footer", () => {
  it("includes ecosystem link", () => {
    const { getByText } = render(<Footer />);
    const link = getByText("Ecosystem");
    expect(link.getAttribute("href")).toBe("/ecosystem");
  });
});
