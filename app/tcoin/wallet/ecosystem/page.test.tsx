/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EcosystemPage, { metadata } from "./page";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));

describe("EcosystemPage", () => {
  it("lists all ecosystem sites", () => {
    const { getAllByRole } = render(<EcosystemPage />);
    const headings = getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(16);
  });

  it("opens links safely in new tabs", () => {
    const { getAllByRole } = render(<EcosystemPage />);
    const links = getAllByRole("link");
    links.forEach((link) => {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  it("exports SEO metadata", () => {
    expect(metadata).toMatchObject({
      title: "TCOIN Ecosystem",
      description:
        "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
      openGraph: {
        title: "TCOIN Ecosystem",
        description:
          "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
        type: "website",
        url: "https://tcoin.me/ecosystem",
      },
      twitter: {
        card: "summary_large_image",
        title: "TCOIN Ecosystem",
        description:
          "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
      },
      alternates: { canonical: "https://tcoin.me/ecosystem" },
    });
  });
});
