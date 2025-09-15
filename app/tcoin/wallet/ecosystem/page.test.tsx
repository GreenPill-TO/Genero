/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EcosystemPage from "./page";

vi.mock("next/link", () => ({ default: (props: any) => <a {...props} /> }));

describe("EcosystemPage", () => {
  it("lists all ecosystem sites", () => {
    const { getAllByRole } = render(<EcosystemPage />);
    const headings = getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(16);
  });
});
