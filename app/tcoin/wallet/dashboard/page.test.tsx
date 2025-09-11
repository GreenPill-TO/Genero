/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

const replaceMock = vi.fn();

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("./screens/WalletScreen", () => ({
  WalletScreen: () => <div data-testid="wallet" />, 
}));

import Dashboard from "./page";
import { useAuth } from "@shared/api/hooks/useAuth";

const mockedUseAuth = useAuth as Mock;

beforeEach(() => {
  replaceMock.mockReset();
  mockedUseAuth.mockReset();
});

describe("Dashboard page redirection", () => {
  it("redirects to /welcome when profile is incomplete", () => {
    mockedUseAuth.mockReturnValue({
      userData: { cubidData: {} },
      error: null,
      isLoadingUser: false,
    });
    render(<Dashboard />);
    expect(replaceMock).toHaveBeenCalledWith("/welcome");
  });

  it("does not redirect when profile is complete", () => {
    mockedUseAuth.mockReturnValue({
      userData: { cubidData: { full_name: "Jane" } },
      error: null,
      isLoadingUser: false,
    });
    render(<Dashboard />);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
