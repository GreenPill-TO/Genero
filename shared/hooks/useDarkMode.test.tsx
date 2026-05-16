/** @vitest-environment jsdom */
import React from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDarkMode from "./useDarkMode";

const matchMediaMock = vi.fn();

describe("useDarkMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    matchMediaMock.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    });
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark");
  });

  it("initialises to dark on first render when following a dark system preference", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener,
      removeEventListener,
    });

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.themeMode).toBe("system");
    expect(result.current.isFollowingSystem).toBe(true);
    expect(result.current.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("respects a cached light override on first render", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    window.localStorage.setItem("theme_cache:wallet:tcoin:default", "light");
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener,
      removeEventListener,
    });

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.themeMode).toBe("light");
    expect(result.current.isFollowingSystem).toBe(false);
    expect(result.current.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
