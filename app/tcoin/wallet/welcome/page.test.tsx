/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@shared/hooks/useDarkMode", () => ({
  default: () => ({
    isDarkMode: false,
  }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  getActiveAppInstance: vi.fn(),
  normaliseDeviceInfo: vi.fn((value) => value),
  serialiseUserShare: vi.fn((value) => value),
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
  });

  it("renders the start state for a first-time user", () => {
    render(<WelcomePage />);

    expect(screen.getByText("Welcome to TCOIN")).toBeTruthy();
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
});
