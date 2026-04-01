/** @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const edgeMocks = vi.hoisted(() => ({
  getMerchantApplicationStatus: vi.fn(async () => ({
    state: "none",
    signupStep: null,
    application: null,
    storeId: null,
  })),
  restartMerchantApplication: vi.fn(async () => ({})),
  saveMerchantApplicationStep: vi.fn(async () => ({})),
  startMerchantApplication: vi.fn(async () => ({ storeId: 1 })),
  submitMerchantApplication: vi.fn(async () => ({})),
  getBiaList: vi.fn(async () => ({ bias: [] })),
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock("@shared/lib/edge/merchantApplicationsClient", () => ({
  getMerchantApplicationStatus: edgeMocks.getMerchantApplicationStatus,
  restartMerchantApplication: edgeMocks.restartMerchantApplication,
  saveMerchantApplicationStep: edgeMocks.saveMerchantApplicationStep,
  startMerchantApplication: edgeMocks.startMerchantApplication,
  submitMerchantApplication: edgeMocks.submitMerchantApplication,
}));

vi.mock("@shared/lib/edge/biaClient", () => ({
  getBiaList: edgeMocks.getBiaList,
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/file.png" } })),
      }),
    },
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tcoin/wallet/components/DashboardFooter", () => ({
  DashboardFooter: () => <div data-testid="dashboard-footer" />,
}));

vi.mock("./LiveMerchantDashboard", () => ({
  LiveMerchantDashboard: () => <div>Live merchant dashboard</div>,
}));

import MerchantDashboardPage from "./page";

describe("MerchantDashboardPage", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      isLoadingUser: false,
      error: null,
    });
    pushMock.mockReset();
    edgeMocks.getMerchantApplicationStatus.mockResolvedValue({
      state: "none",
      signupStep: null,
      application: null,
      storeId: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the shared dashboard shell and footer", async () => {
    const { container } = render(<MerchantDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Merchant Dashboard/i)).toBeTruthy();
    });

    expect((container.firstChild as HTMLElement).className).toContain("lg:pl-40");
    expect((container.firstChild as HTMLElement).className).toContain("xl:pl-44");
    expect(screen.getByTestId("dashboard-footer")).toBeTruthy();
  });
});
