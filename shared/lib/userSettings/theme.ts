import { resolveUserSettingsAppContext } from "./context";
import type { UserSettingsAppContext, UserSettingsTheme } from "./types";

export function normaliseThemePreference(value: unknown): UserSettingsTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function resolveThemeCacheKey(context?: Partial<UserSettingsAppContext> | null): string {
  const resolved = resolveUserSettingsAppContext(context);
  const environment = resolved.environment || "default";
  return `theme_cache:${resolved.appSlug}:${resolved.citySlug}:${environment}`;
}

export function readCachedThemePreference(context?: Partial<UserSettingsAppContext> | null): UserSettingsTheme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(resolveThemeCacheKey(context));
  if (raw == null) {
    return null;
  }

  return normaliseThemePreference(raw);
}

export function writeCachedThemePreference(
  theme: UserSettingsTheme,
  context?: Partial<UserSettingsAppContext> | null
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(resolveThemeCacheKey(context), normaliseThemePreference(theme));
}

export function readLegacyThemePreference(): UserSettingsTheme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const legacyTheme = window.localStorage.getItem("theme");
  const legacyUserSet = window.localStorage.getItem("theme_user_set") === "1";
  if (!legacyUserSet) {
    return null;
  }

  if (legacyTheme === "light" || legacyTheme === "dark") {
    return legacyTheme;
  }

  return null;
}

export function migrateLegacyThemePreference(
  context?: Partial<UserSettingsAppContext> | null
): UserSettingsTheme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = readCachedThemePreference(context);
  if (existing) {
    return existing;
  }

  const legacy = readLegacyThemePreference();
  if (!legacy) {
    return null;
  }

  writeCachedThemePreference(legacy, context);
  return legacy;
}

export function resolveSystemPrefersDark(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemePreference(theme: UserSettingsTheme): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const prefersDark = resolveSystemPrefersDark();
  const shouldUseDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", shouldUseDark);
  return shouldUseDark;
}
