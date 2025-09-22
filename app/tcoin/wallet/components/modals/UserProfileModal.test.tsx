/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfileModal } from "./UserProfileModal";

const closeModal = vi.fn();
const invalidateQueries = vi.fn();
const updateCubidDataInSupabase = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

const baseUserData = {
  cubidData: {
    full_name: "Test User",
    nickname: "Tester",
    profile_image_url: null,
    country: "Canada (+1)",
    phone: "+1 555 123 4567",
    username: "testuser",
    email: "test@example.com",
    id: 123,
    cubid_id: "cubid-123",
  },
  user: {
    cubid_id: "cubid-123",
    email: "test@example.com",
    id: 123,
  },
};

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ userData: baseUserData })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  updateCubidDataInSupabase: (...args: any[]) => updateCubidDataInSupabase(...args),
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/avatar.png" } }),
      }),
    },
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

describe("UserProfileModal", () => {
  beforeEach(() => {
    updateCubidDataInSupabase.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls closeModal on Escape key press", () => {
    render(<UserProfileModal closeModal={closeModal} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeModal).toHaveBeenCalled();
  });

  it("submits updated profile details", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/Preferred name/i), { target: { value: "JD" } });
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: "+1 555 999 0000" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateCubidDataInSupabase).toHaveBeenCalled());

    expect(updateCubidDataInSupabase).toHaveBeenCalledWith("cubid-123", {
      full_name: "Jane Doe",
      nickname: "JD",
      country: "Canada (+1)",
      phone: "+1 555 999 0000",
      profile_image_url: null,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["user-data"] });
    expect(toastSuccess).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
