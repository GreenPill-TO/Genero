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
vi.mock("@shared/lib/edge/userRequestsClient", () => ({
  createUserRequest: vi.fn(),
}));

import ContactPage from "./page";

describe("ContactPage", () => {
  it("keeps the WhatsApp hyperlink scoped to the shortest CTA text", () => {
    render(<ContactPage />);

    const whatsappLink = screen.getByRole("link", { name: "WhatsApp" });
    expect(whatsappLink.getAttribute("href")).toBe(
      "https://chat.whatsapp.com/EXF4AkkksYA0fY26nQhrTv"
    );
    expect(screen.queryByRole("link", { name: "Join our WhatsApp" })).toBeNull();
  });

  it("renders a taller message textarea", () => {
    render(<ContactPage />);

    expect(screen.getByLabelText("Message").className).toContain("min-h-40");
  });
});
