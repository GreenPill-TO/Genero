/** @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const selectResponses = vi.hoisted(() => ({
  interac_transfer: { data: [], error: null as any },
  off_ramp_req: { data: [], error: null as any },
  ref_request_statuses: { data: [], error: null as any },
}));
const updateCalls = vi.hoisted(
  () => [] as Array<{ table: string; payload: Record<string, unknown> }>
);

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

import AdminDashboardPage from "./page";

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      userData: {
        cubidData: {
          is_admin: true,
          full_name: "Admin User",
        },
      },
      isLoading: false,
    });
    replaceMock.mockReset();
    mockFrom.mockClear();
    updateCalls.length = 0;
    const responses = getResponses();
    responses.interac_transfer = { data: [], error: null };
    responses.off_ramp_req = { data: [], error: null };
    responses.ref_request_statuses = { data: [], error: null };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("redirects users without admin access", () => {
    useAuthMock.mockReturnValue({ userData: { cubidData: { is_admin: false } }, isLoading: false });

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
