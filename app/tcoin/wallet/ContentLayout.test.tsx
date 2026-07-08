/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useIndexerTrigger", () => ({
  useIndexerTrigger: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => usePathnameMock(),
}));

vi.mock("@tcoin/wallet/components/navbar", () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-navbar" />,
}));

import ContentLayout from "./ContentLayout";

describe("ContentLayout", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    usePathnameMock.mockReturnValue("/dashboard");
    pushMock.mockReset();
  });

  it("marks authenticated non-public routes as a dedicated mobile scroll frame", () => {
    render(
      <ContentLayout>
        <div>dashboard</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-root").className).toContain("wallet-auth-frame");
    expect(screen.getByTestId("wallet-layout-scroll-region").className).toContain("wallet-auth-scroll-region");
    expect(screen.getByTestId("wallet-navbar")).toBeTruthy();
  });

  it("centres the initial loading state in the viewport", () => {
    useAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });

    render(
      <ContentLayout>
        <div>loading</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-loading").className).toContain("items-center");
    expect(screen.getByTestId("wallet-layout-loading").className).toContain("justify-center");
    expect(screen.getByText("...loading")).toBeTruthy();
  });

  it("does not apply the authenticated scroll frame on public routes", () => {
    usePathnameMock.mockReturnValue("/");

    render(
      <ContentLayout>
        <div>public</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-root").className).not.toContain("wallet-auth-frame");
    expect(screen.getByTestId("wallet-layout-root").className).toContain("wallet-public-shell");
    expect(screen.getByTestId("wallet-layout-scroll-region").className).toBe("");
    expect(screen.queryByTestId("wallet-navbar")).toBeNull();
  });

  it("treats pay-link routes as public wallet paths", () => {
    usePathnameMock.mockReturnValue("/pay/opaque-token");

    render(
      <ContentLayout>
        <div>pay</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-root").className).not.toContain("wallet-auth-frame");
    expect(screen.getByTestId("wallet-layout-root").className).toContain("wallet-public-shell");
    expect(screen.queryByTestId("wallet-navbar")).toBeNull();
  });

  it("treats the prefixed wallet landing route as public", () => {
    usePathnameMock.mockReturnValue("/tcoin/wallet");
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    render(
      <ContentLayout>
        <div>prefixed public</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-root").className).toContain("wallet-public-shell");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("allows unauthenticated dashboard preview routes to render without redirecting home", () => {
    usePathnameMock.mockReturnValue("/tcoin/wallet/dashboard");
    useAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    });

    render(
      <ContentLayout>
        <div>dashboard preview</div>
      </ContentLayout>
    );

    expect(screen.getByTestId("wallet-layout-root").className).toContain("wallet-auth-frame");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
