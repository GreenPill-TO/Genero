/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomePage from "./page";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const openModalMock = vi.fn();
const closeModalMock = vi.fn();
const startMutateAsync = vi.fn();
const saveStepMutateAsync = vi.fn();
const resetMutateAsync = vi.fn();
const completeMutateAsync = vi.fn();

const useUserSettingsMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());
const prepareProfilePictureMock = vi.hoisted(() => vi.fn());
const uploadProfilePictureMock = vi.hoisted(() => vi.fn());

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockDynamicComponent = () => <div data-testid="dynamic-component" />;
    return MockDynamicComponent;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => useUserSettingsMock(),
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({
    openModal: openModalMock,
    closeModal: closeModalMock,
  }),
}));

vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useStartUserSignupMutation: () => ({
    mutateAsync: startMutateAsync,
    isPending: false,
  }),
  useSaveUserSignupStepMutation: () => ({
    mutateAsync: saveStepMutateAsync,
    isPending: false,
  }),
  useResetUserSignupMutation: () => ({
    mutateAsync: resetMutateAsync,
    isPending: false,
  }),
  useCompleteUserSignupMutation: () => ({
    mutateAsync: completeMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  getActiveAppInstance: vi.fn(),
  normaliseDeviceInfo: vi.fn((value) => value),
  serialiseUserShare: vi.fn((value) => value),
}));

vi.mock("@shared/lib/profilePictureCrop", () => ({
  prepareProfilePicture: (...args: any[]) => prepareProfilePictureMock(...args),
  createCroppedProfilePictureFile: vi.fn(),
  getProfilePictureCropFrame: vi.fn(() => ({
    scaledWidth: 96,
    scaledHeight: 96,
    x: 0,
    y: 0,
    maxOffsetX: 0,
    maxOffsetY: 0,
  })),
}));

vi.mock("@shared/lib/supabase/profilePictures", () => ({
  uploadProfilePicture: (...args: any[]) => uploadProfilePictureMock(...args),
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tcoin/wallet/components/modals/SignInModal", () => ({
  __esModule: true,
  default: () => <div data-testid="sign-in-modal" />,
}));

const createBootstrap = (
  signupState: "none" | "draft" | "completed",
  overrides?: Partial<{
    currentStep: number | null;
    completedSteps: number[];
    walletReady: boolean;
    environment: string;
  }>
) => ({
  user: {
    id: 1,
    cubidId: "cubid-1",
    email: "test@example.com",
    phone: null,
    fullName: "Test User",
    firstName: "Test",
    lastName: "User",
    nickname: null,
    username: "testuser",
    country: "Canada",
    profileImageUrl: null,
    hasCompletedIntro: signupState === "completed",
    isNewUser: signupState !== "completed",
  },
  app: {
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: overrides?.environment ?? "",
    appInstanceId: 1,
  },
  preferences: {
    theme: "system" as const,
    charity: "Food Bank",
    selectedCause: "Food Bank",
    primaryBiaId: "1",
    secondaryBiaIds: [],
  },
  signup: {
    state: signupState,
    currentStep: overrides?.currentStep ?? (signupState === "draft" ? 3 : null),
    completedSteps: overrides?.completedSteps ?? (signupState === "draft" ? [1, 2] : []),
    walletReady: overrides?.walletReady ?? false,
    phoneVerified: true,
  },
  options: {
    charities: [{ id: "1", name: "Food Bank", value: "Food Bank" }],
    bias: [{ id: "1", code: "DTA", name: "Downtown" }],
  },
});

describe("WelcomePage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "";
    startMutateAsync.mockResolvedValue({ signup: { currentStep: 1 } });
    saveStepMutateAsync.mockResolvedValue({ signup: { currentStep: 2 } });
    resetMutateAsync.mockResolvedValue({
      signup: { state: "none", currentStep: null },
    });
    prepareProfilePictureMock.mockResolvedValue({
      file: new File(["avatar"], "avatar.png", { type: "image/png" }),
      previewUrl: "blob:welcome-avatar",
      width: 1200,
      height: 1600,
    });
    uploadProfilePictureMock.mockResolvedValue("https://example.com/avatar.png");
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      userData: null,
      authData: { user: { email: "test@example.com" } },
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("none"),
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders the start state for a first-time user", () => {
    render(<WelcomePage />);

    expect(screen.getByTestId("welcome-page-shell").className).toContain("font-sans");
    expect(screen.getByTestId("welcome-primary-panel")).toBeTruthy();
    expect(screen.getByText("Welcome to TCOIN")).toBeTruthy();
    expect(screen.getByText(/create a better local economic system/i)).toBeTruthy();
    expect(screen.getByText(/approx 5,500% by now, or 4% per year/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start setup/i })).toBeTruthy();
  });

  it("renders an authenticate state when the user is signed out", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      userData: null,
      authData: null,
    });
    useUserSettingsMock.mockReturnValue({
      bootstrap: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    expect(screen.getByText("Welcome to TCOIN")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Authenticate/i })).toBeTruthy();
  });

  it("renders authenticated loading state inside the wallet shell", () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: null,
      isLoading: true,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    expect(screen.getByTestId("welcome-page-shell").className).toContain("font-sans");
    expect(screen.getByText("Loading welcome flow…")).toBeTruthy();
  });

  it("renders the resume state for an incomplete signup", () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("draft"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    expect(screen.getByText("Resume your signup")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });

  it("returns to the step 0 welcome card after reset instead of reopening the wizard", async () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("draft"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(resetMutateAsync).toHaveBeenCalled());
    expect(screen.getByText("Welcome to TCOIN")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start setup/i })).toBeTruthy();
    expect(screen.queryByText(/Step 1 of 6/i)).toBeNull();
  });

  it("redirects completed users to the dashboard", () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("completed"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the step 5 skip button in development", () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "development";
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("draft", {
        currentStep: 5,
        completedSteps: [1, 2, 3, 4],
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
  });

  it("uses step 1 for signup-process guidance after the welcome card", async () => {
    render(<WelcomePage />);

    fireEvent.click(screen.getByRole("button", { name: /Start setup/i }));

    expect(await screen.findByText(/Let's set up your profile, community defaults, and wallet access together/i)).toBeTruthy();
    expect(screen.getByText(/Your progress is saved step by step/i)).toBeTruthy();
  });

  it("shows rotating Toronto placeholders on step 2 instead of prefilled names", async () => {
    vi.useFakeTimers();

    render(<WelcomePage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start setup/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    });

    expect(screen.getByText(/Required to continue/i)).toBeTruthy();
    expect(screen.getByText(/Optional for now/i)).toBeTruthy();
    expect(screen.getByText(/First name, last name, country, and phone verification are required/i)).toBeTruthy();
    expect(screen.getByText(/Preferred name and username can be added now or later/i)).toBeTruthy();
    expect((screen.getByLabelText(/^First name$/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^First name$/i) as HTMLInputElement).placeholder).toBe("Mats");
    expect((screen.getByLabelText(/^Last name$/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Last name$/i) as HTMLInputElement).placeholder).toBe("Sundin");
    expect((screen.getByLabelText(/^Preferred name$/i) as HTMLInputElement).placeholder).toBe("Mats");
    expect((screen.getByLabelText(/^Username$/i) as HTMLInputElement).placeholder).toBe("mats.sundin");
    expect(screen.getByText(/^Canada \(\+1\)$/i)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect((screen.getByLabelText(/^First name$/i) as HTMLInputElement).placeholder).toBe("Nathan");
    expect((screen.getByLabelText(/^Last name$/i) as HTMLInputElement).placeholder).toBe("Philips");
    expect((screen.getByLabelText(/^Preferred name$/i) as HTMLInputElement).placeholder).toBe("Nathan");
    expect((screen.getByLabelText(/^Username$/i) as HTMLInputElement).placeholder).toBe("nathan.philips");
    expect(screen.getByText(/^Canada \(\+1\)$/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^First name$/i), {
      target: { value: "A" },
    });

    expect((screen.getByLabelText(/^First name$/i) as HTMLInputElement).placeholder).toBe("");
    expect((screen.getByLabelText(/^Last name$/i) as HTMLInputElement).placeholder).toBe("");
    expect((screen.getByLabelText(/^Preferred name$/i) as HTMLInputElement).placeholder).toBe("");
    expect((screen.getByLabelText(/^Username$/i) as HTMLInputElement).placeholder).toBe("");

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect((screen.getByLabelText(/^Last name$/i) as HTMLInputElement).placeholder).toBe("");

    const countryLabel = screen.getByText(/^Country$/i);
    const phoneHeading = screen.getByText(/^Phone verification$/i);
    expect(countryLabel.compareDocumentPosition(phoneHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the picture editor modal after choosing an image on step 3", async () => {
    useUserSettingsMock.mockReturnValue({
      bootstrap: createBootstrap("draft", {
        currentStep: 3,
        completedSteps: [1, 2],
      }),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<WelcomePage />);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.change(screen.getByLabelText(/Choose a profile picture/i), {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });

    await waitFor(() => expect(prepareProfilePictureMock).toHaveBeenCalled());
    expect(openModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        elSize: "xl",
      })
    );
  });
});
