/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggleButton } from "./ThemeToggleButton";

const syncThemePreferenceMock = vi.fn();
const mutateAsyncMock = vi.fn();
const darkModeStateMock = vi.fn();
const userSettingsStateMock = vi.fn();

vi.mock("@shared/hooks/useDarkMode", () => ({
  __esModule: true,
  default: () => darkModeStateMock(),
}));

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => userSettingsStateMock(),
}));

vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useUpdateUserPreferencesMutation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("ThemeToggleButton", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    syncThemePreferenceMock.mockReset();
    mutateAsyncMock.mockReset();
    userSettingsStateMock.mockReturnValue({
      bootstrap: {
        preferences: {
          theme: "system",
        },
      },
    });
  });

  it("shows system as an explicit current state", () => {
    darkModeStateMock.mockReturnValue({
      themeMode: "system",
      syncThemePreference: syncThemePreferenceMock,
    });

    render(<ThemeToggleButton />);

    expect(screen.getByRole("button", { name: /Theme: System\. Switch to Light\./i })).toBeTruthy();
  });

  it("cycles from system to light and persists the choice", async () => {
    darkModeStateMock.mockReturnValue({
      themeMode: "system",
      syncThemePreference: syncThemePreferenceMock,
    });
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ThemeToggleButton />);

    fireEvent.click(screen.getByTestId("theme-toggle-button"));

    expect(syncThemePreferenceMock).toHaveBeenCalledWith("light");
    expect(mutateAsyncMock).toHaveBeenCalledWith({ theme: "light" });
  });

  it("cycles from light to dark", async () => {
    darkModeStateMock.mockReturnValue({
      themeMode: "light",
      syncThemePreference: syncThemePreferenceMock,
    });
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ThemeToggleButton />);

    fireEvent.click(screen.getByTestId("theme-toggle-button"));

    expect(syncThemePreferenceMock).toHaveBeenCalledWith("dark");
    expect(mutateAsyncMock).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("cycles from dark back to system", async () => {
    darkModeStateMock.mockReturnValue({
      themeMode: "dark",
      syncThemePreference: syncThemePreferenceMock,
    });
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ThemeToggleButton />);

    fireEvent.click(screen.getByTestId("theme-toggle-button"));

    expect(syncThemePreferenceMock).toHaveBeenCalledWith("system");
    expect(mutateAsyncMock).toHaveBeenCalledWith({ theme: "system" });
  });
});
