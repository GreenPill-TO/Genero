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
const prepareProfilePictureFromUrlMock = vi.fn();
const createCroppedProfilePictureFileMock = vi.fn();
const getProfilePictureCropFrameMock = vi.fn();
const bootstrapUser = {
  id: 123,
  cubidId: "cubid-123",
  email: "test@example.com",
  emails: [
    {
      id: 1,
      email: "test@example.com",
      isPrimary: true,
      createdAt: "2026-04-02T00:00:00.000Z",
    },
  ],
  phone: "+1 555 123 4567",
  fullName: "Test User",
  firstName: "Test",
  lastName: "User",
  nickname: "Tester",
  username: "testuser",
  country: "Canada (+1)",
  address: "123 Queen St W, Toronto, ON",
  profileImageUrl: null as string | null,
  hasCompletedIntro: false,
  isNewUser: true,
};

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    bootstrap: {
      user: bootstrapUser,
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
  prepareProfilePictureFromUrl: (...args: any[]) => prepareProfilePictureFromUrlMock(...args),
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
    bootstrapUser.profileImageUrl = null;
    bootstrapUser.emails = [
      {
        id: 1,
        email: "test@example.com",
        isPrimary: true,
        createdAt: "2026-04-02T00:00:00.000Z",
      },
    ];
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
    prepareProfilePictureFromUrlMock.mockImplementation(async () => ({
      file: new File(["existing"], "existing-avatar.png", { type: "image/png" }),
      previewUrl: "blob:existing-avatar-preview",
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

    expect(screen.getByText(/^Picture$/i)).toBeTruthy();
    expect(screen.getByText(/^Email$/i)).toBeTruthy();
    expect(screen.getByText(/Banking info/i)).toBeTruthy();
    expect(screen.getByText(/Info used in this app/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Given name\(s\)/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/Preferred name/i), { target: { value: "JD" } });
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "janedoe" } });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: "456 King St W, Toronto, ON" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateProfileMutateAsync).toHaveBeenCalled());

    expect(updateProfileMutateAsync).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      nickname: "JD",
      emails: [
        {
          email: "test@example.com",
          isPrimary: true,
        },
      ],
      country: "Canada (+1)",
      address: "456 King St W, Toronto, ON",
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

  it("shows tooltip copy for banking privacy and address requirements", () => {
    render(<UserProfileModal closeModal={closeModal} />);

    expect(screen.getByLabelText(/This info won't be shared with other users\./i)).toBeTruthy();
    expect(
      screen.getByLabelText(/We only need an address before any withdrawals, so you can leave this blank until then\./i)
    ).toBeTruthy();
  });

  it("renders the profile editor as four panels", () => {
    render(<UserProfileModal closeModal={closeModal} />);

    expect(screen.getByTestId("profile-picture-panel")).toBeTruthy();
    expect(screen.getByTestId("profile-email-panel")).toBeTruthy();
    expect(screen.getByTestId("profile-banking-panel")).toBeTruthy();
    expect(screen.getByTestId("profile-app-info-panel")).toBeTruthy();
    expect((screen.getByLabelText(/Email address 1/i) as HTMLInputElement).value).toBe("test@example.com");
  });

  it("lets the user add another email and choose a different primary email", async () => {
    render(<UserProfileModal closeModal={closeModal} />);

    fireEvent.click(screen.getByRole("button", { name: /Add another email/i }));
    fireEvent.change(screen.getByLabelText(/Email address 2/i), {
      target: { value: "other@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Make primary/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateProfileMutateAsync).toHaveBeenCalled());
    expect(updateProfileMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [
          {
            email: "test@example.com",
            isPrimary: false,
          },
          {
            email: "other@example.com",
            isPrimary: true,
          },
        ],
      })
    );
  });

  it("keeps the only email locked as the primary email", () => {
    render(<UserProfileModal closeModal={closeModal} />);

    expect(screen.getByText(/^Primary$/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Remove$/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/There must always be at least one email address on the account\./i)).toBeTruthy();
  });

  it("requires a different primary email before removing the current primary", () => {
    bootstrapUser.emails = [
      {
        id: 1,
        email: "test@example.com",
        isPrimary: true,
        createdAt: "2026-04-02T00:00:00.000Z",
      },
      {
        id: 2,
        email: "backup@example.com",
        isPrimary: false,
        createdAt: "2026-04-02T00:05:00.000Z",
      },
    ];

    render(<UserProfileModal closeModal={closeModal} />);

    const removeButtons = screen.getAllByRole("button", { name: /^Remove$/i });
    expect(removeButtons[0]?.hasAttribute("disabled")).toBe(true);
    expect(removeButtons[1]?.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/Choose a different primary email before removing this one\./i)).toBeTruthy();
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

  it("can reopen an existing profile picture for framing", async () => {
    bootstrapUser.profileImageUrl = "https://example.com/existing-avatar.png";

    render(<UserProfileModal closeModal={closeModal} />);

    fireEvent.click(screen.getByRole("button", { name: /Adjust current photo/i }));

    await waitFor(() =>
      expect(prepareProfilePictureFromUrlMock).toHaveBeenCalledWith(
        "https://example.com/existing-avatar.png",
        "testuser"
      )
    );
    expect(screen.getByText(/Profile picture framing/i)).toBeTruthy();
  });
});
