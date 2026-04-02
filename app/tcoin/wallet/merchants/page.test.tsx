/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MerchantsPage, { metadata } from "./page";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));
vi.mock("@tcoin/wallet/components/landing-header", () => ({
  LandingHeader: () => <div data-testid="landing-header" />,
}));
vi.mock("@tcoin/wallet/components/footer", () => ({
  Footer: () => <div data-testid="landing-footer" />,
}));

describe("MerchantsPage", () => {
  it("renders the merchant sales pitch and setup guidance", () => {
    render(<MerchantsPage />);

    expect(screen.getByRole("heading", { name: "For Merchants" })).toBeTruthy();
    expect(
      screen.getByText(
        /Turn your everyday sales into a smarter system that brings customers back, reduces fees, and connects you with other local businesses\./
      )
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Simple to start" })).toBeTruthy();
    expect(
      screen.getByText(
        /The first step is to log in, sign up as an individual\. Then go to the Merchant Signup Page and let us know about where you are and what you sell\./
      )
    ).toBeTruthy();
  });

  it("exports SEO metadata", () => {
    expect(metadata).toMatchObject({
      title: "TCOIN for Merchants",
      description:
        "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
      openGraph: {
        title: "TCOIN for Merchants",
        description:
          "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
        type: "website",
        url: "https://tcoin.me/merchants",
      },
      twitter: {
        card: "summary_large_image",
        title: "TCOIN for Merchants",
        description:
          "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
      },
      alternates: { canonical: "https://tcoin.me/merchants" },
    });
  });
});
