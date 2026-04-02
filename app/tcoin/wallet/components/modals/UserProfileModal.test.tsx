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
const prepareProfilePictureMock = vi.fn();
const createCroppedProfilePictureFileMock = vi.fn();
const getProfilePictureCropFrameMock = vi.fn();

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

vi.mock("@shared/lib/profilePictureCrop", () => ({
  prepareProfilePicture: (...args: any[]) => prepareProfilePictureMock(...args),
  createCroppedProfilePictureFile: (...args: any[]) => createCroppedProfilePictureFileMock(...args),
  describeProfilePictureOrientation: (width: number, height: number) => {
    if (width > height) return "landscape";
    if (height > width) return "portrait";
    return "square";
  },
  getProfilePictureCropFrame: (...args: any[]) => getProfilePictureCropFrameMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

describe("UserProfileModal", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    updateProfileMutateAsync.mockResolvedValue({ user: { id: 123 } });
    uploadProfilePictureMock.mockResolvedValue("https://example.com/avatar.png");
    prepareProfilePictureMock.mockImplementation(async (file: File) => ({
      file,
      previewUrl: "blob:avatar-preview",
      width: 1200,
      height: 1800,
    }));
    getProfilePictureCropFrameMock.mockImplementation(({ cropSize }: { cropSize: number }) => ({
      scaledWidth: cropSize,
      scaledHeight: cropSize * 1.5,
      x: 0,
      y: cropSize * -0.25,
      maxOffsetX: 0,
      maxOffsetY: cropSize * 0.25,
    }));
    createCroppedProfilePictureFileMock.mockImplementation(
      async () => new File(["cropped"], "avatar-cropped.png", { type: "image/png" })
    );
    URL.createObjectURL = vi.fn(() => "blob:avatar-preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("calls closeModal on Escape key press", () => {
    render(<UserProfileModal closeModal={closeModal} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeModal).toHaveBeenCalled();
  });

  it("submits updated profile details", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    expect(screen.getByText(/Banking info/i)).toBeTruthy();
    expect(screen.getByText(/Info used in this app/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Given name\(s\)/i), { target: { value: "Jane" } });
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

  it("only shows country choices after the user starts typing", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    const countryInput = screen.getByLabelText(/Country or Country number/i);

    fireEvent.focus(countryInput);
    expect(screen.queryByRole("option", { name: /^United States \(\+1\)$/i })).toBeNull();

    fireEvent.change(countryInput, { target: { value: "United" } });

    await waitFor(() => expect(screen.getByRole("option", { name: /^United States \(\+1\)$/i })).toBeTruthy());
  });

  it("shows crop controls for a selected image and uploads the cropped result before saving", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Profile picture/i), {
      target: {
        files: [file],
      },
    });

    await waitFor(() => expect(prepareProfilePictureMock).toHaveBeenCalledWith(file));
    expect(screen.getByText(/Profile picture framing/i)).toBeTruthy();
    expect(getProfilePictureCropFrameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cropSize: 80,
      })
    );
    expect(getProfilePictureCropFrameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cropSize: 176,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() =>
      expect(createCroppedProfilePictureFileMock).toHaveBeenCalledWith({
        source: {
          file,
          previewUrl: "blob:avatar-preview",
          width: 1200,
          height: 1800,
        },
        crop: {
          offsetX: 0,
          offsetY: 0,
          zoom: 1,
        },
      })
    );
    await waitFor(() =>
      expect(uploadProfilePictureMock).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ name: "avatar-cropped.png" })
      )
    );
    expect(updateProfileMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        profileImageUrl: "https://example.com/avatar.png",
      })
    );
  });
});
