/** @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const useControlPlaneAccessMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const selectResponses = vi.hoisted(() => ({
  interac_transfer: { data: [], error: null as any },
  off_ramp_req: { data: [], error: null as any },
  ref_request_statuses: { data: [], error: null as any },
}));
const updateCalls = vi.hoisted(
  () => [] as Array<{ table: string; payload: Record<string, unknown> }>
);
const edgeMocks = vi.hoisted(() => ({
  getBiaList: vi.fn(async () => ({ bias: [], controls: [] })),
  getBiaMappings: vi.fn(async () => ({ health: null })),
  getBiaControls: vi.fn(async () => ({ controls: [] })),
  createBia: vi.fn(async () => ({ bia: {} })),
  saveBiaMappings: vi.fn(async () => ({ mappings: [] })),
  saveBiaControls: vi.fn(async () => ({ controls: {} })),
  getRedemptionRequests: vi.fn(async () => ({ requests: [] })),
  approveRedemptionRequest: vi.fn(async () => ({ request: {} })),
  settleRedemptionRequest: vi.fn(async () => ({ request: {}, settlement: {} })),
  getGovernanceActions: vi.fn(async () => ({ actions: [] })),
}));

const mockFrom = vi.hoisted(() =>
  vi.fn((table: string) => ({
    select: vi.fn(() => ({
      order: vi.fn(async () => (selectResponses as any)[table] ?? { data: [], error: null }),
    })),
    update: vi.fn((payload: any) => ({
      eq: vi.fn(async () => {
        updateCalls.push({ table, payload });
        return { data: [], error: null };
      }),
    })),
  }))
);

const getResponses = () =>
  selectResponses as Record<string, { data: unknown[]; error: unknown }>;

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/api/hooks/useControlPlaneAccess", () => ({
  useControlPlaneAccess: () => useControlPlaneAccessMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@shared/lib/edge/biaClient", () => edgeMocks);
vi.mock("@shared/lib/edge/redemptionsClient", () => ({
  getRedemptionRequests: edgeMocks.getRedemptionRequests,
  approveRedemptionRequest: edgeMocks.approveRedemptionRequest,
  settleRedemptionRequest: edgeMocks.settleRedemptionRequest,
}));
vi.mock("@shared/lib/edge/governanceClient", () => ({
  getGovernanceActions: edgeMocks.getGovernanceActions,
}));

import AdminDashboardPage from "./page";

const createFetchResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(async () => body),
});

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          is_admin: true,
          full_name: "Admin User",
        },
      },
      isLoading: false,
    });
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessAdminDashboard: true,
      },
      error: null,
      isLoading: false,
    });
    replaceMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/ramp-requests")) {
        return createFetchResponse({
          onRampRequests: selectResponses.interac_transfer.data,
          offRampRequests: selectResponses.off_ramp_req.data,
          statuses: selectResponses.ref_request_statuses.data,
        });
      }

      return createFetchResponse({});
    });
    mockFrom.mockClear();
    updateCalls.length = 0;
    edgeMocks.getBiaList.mockResolvedValue({ bias: [], controls: [] });
    edgeMocks.getBiaMappings.mockResolvedValue({ health: null });
    edgeMocks.getBiaControls.mockResolvedValue({ controls: [] });
    edgeMocks.getRedemptionRequests.mockResolvedValue({ requests: [] });
    edgeMocks.getGovernanceActions.mockResolvedValue({ actions: [] });
    const responses = getResponses();
    responses.interac_transfer = { data: [], error: null };
    responses.off_ramp_req = { data: [], error: null };
    responses.ref_request_statuses = { data: [], error: null };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("redirects users without admin access", () => {
    useControlPlaneAccessMock.mockReturnValue({
      data: {
        canAccessAdminDashboard: false,
      },
      error: null,
      isLoading: false,
    });

    render(<AdminDashboardPage />);

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    expect(screen.getByText(/Restricted area/i)).toBeTruthy();
  });

  it("renders ramp requests returned by Supabase", async () => {
    getResponses().interac_transfer = {
      data: [
        {
          id: 7,
          created_at: "2024-01-01T10:00:00Z",
          amount: "100",
          amount_override: null,
          status: "requested",
          admin_notes: null,
          bank_reference: null,
          interac_code: "REF-123",
          is_sent: true,
          approved_timestamp: null,
          user_id: 5,
          users: { full_name: "Dana", email: "dana@example.com" },
        },
      ],
      error: null,
    };
    getResponses().off_ramp_req = {
      data: [
        {
          id: 4,
          created_at: "2024-01-02T12:00:00Z",
          updated_at: "2024-01-03T12:00:00Z",
          cad_to_user: "250",
          tokens_burned: "75",
          exchange_rate: "3.3",
          cad_off_ramp_fee: "5",
          admin_notes: null,
          bank_reference_number: "BNK-77",
          status: "initiated",
          interac_transfer_target: "user@bank.ca",
          wallet_account: "0xabc",
          user_id: 8,
          users: { full_name: "Lee", email: "lee@example.com" },
        },
      ],
      error: null,
    };
    getResponses().ref_request_statuses = {
      data: [{ status: "requested" }, { status: "completed" }],
      error: null,
    };

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Request #7/)).toBeTruthy();
      expect(screen.getByText(/Request #4/)).toBeTruthy();
    });

    expect(screen.getByText(/Dana/)).toBeTruthy();
    expect(screen.getByText(/lee@example.com/)).toBeTruthy();
    expect(screen.getByText(/1 awaiting review/i)).toBeTruthy();
    expect(screen.getByText(/1 in progress/i)).toBeTruthy();
  });

  it("saves edits to on-ramp requests", async () => {
    getResponses().interac_transfer = {
      data: [
        {
          id: 9,
          created_at: "2024-01-04T08:00:00Z",
          amount: "150",
          amount_override: null,
          status: "requested",
          admin_notes: null,
          bank_reference: null,
          interac_code: "REF-999",
          is_sent: false,
          approved_timestamp: null,
          user_id: 12,
          users: { full_name: "Morgan", email: "morgan@example.com" },
        },
      ],
      error: null,
    };
    getResponses().off_ramp_req = { data: [], error: null };
    getResponses().ref_request_statuses = {
      data: [{ status: "requested" }, { status: "completed" }],
      error: null,
    };

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Request #9/)).toBeTruthy();
    });

    const notesField = screen.getByLabelText(
      /Internal notes for on-ramp request 9/i
    ) as HTMLTextAreaElement;
    fireEvent.change(notesField, { target: { value: "Manual verification complete" } });

    await waitFor(() => {
      expect(
        (
          screen.getByLabelText(
            /Internal notes for on-ramp request 9/i
          ) as HTMLTextAreaElement
        ).value
      ).toBe("Manual verification complete");
    });

    await waitFor(() => {
      const [saveButton] = screen.getAllByRole("button", { name: /Save changes/i });
      expect(saveButton.hasAttribute("disabled")).toBe(false);
    });

    const [saveButton] = screen.getAllByRole("button", { name: /Save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    expect(updateCalls[0]).toMatchObject({
      table: "interac_transfer",
      payload: {
        admin_notes: "Manual verification complete",
        bank_reference: null,
        status: "requested",
      },
    });
  });
});
