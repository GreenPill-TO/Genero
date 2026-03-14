/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfileModal } from "./UserProfileModal";

const closeModal = vi.fn();
const updateProfileMutateAsync = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const uploadProfilePictureMock = vi.fn();

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    bootstrap: {
      user: {
        id: 123,
        cubidId: "cubid-123",
        email: "test@example.com",
        phone: "+1 555 123 4567",
        fullName: "Test User",
        firstName: "Test",
        lastName: "User",
        nickname: "Tester",
        username: "testuser",
        country: "Canada (+1)",
        profileImageUrl: null,
        hasCompletedIntro: false,
        isNewUser: true,
      },
    },
  }),
}));

vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useUpdateUserProfileMutation: () => ({
    mutateAsync: (...args: any[]) => updateProfileMutateAsync(...args),
    isPending: false,
  }),
}));

vi.mock("@shared/lib/supabase/profilePictures", () => ({
  uploadProfilePicture: (...args: any[]) => uploadProfilePictureMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

describe("UserProfileModal", () => {
  beforeEach(() => {
    updateProfileMutateAsync.mockResolvedValue({ user: { id: 123 } });
    uploadProfilePictureMock.mockResolvedValue("https://example.com/avatar.png");
    URL.createObjectURL = vi.fn(() => "blob:avatar-preview");
    URL.revokeObjectURL = vi.fn();
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
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "janedoe" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateProfileMutateAsync).toHaveBeenCalled());

    expect(updateProfileMutateAsync).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      nickname: "JD",
      country: "Canada (+1)",
      profileImageUrl: null,
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("uploads a selected profile picture before saving", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Profile picture/i), {
      target: {
        files: [file],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(uploadProfilePictureMock).toHaveBeenCalledWith(123, file));
    expect(updateProfileMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        profileImageUrl: "https://example.com/avatar.png",
      })
    );
  });
});
