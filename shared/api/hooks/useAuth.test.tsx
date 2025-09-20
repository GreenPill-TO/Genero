import React, { type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authStateChangeHandlerRef = vi.hoisted(() => ({
  current: null as ((event: string, session: Session | null) => void) | null,
}));
const unsubscribeMock = vi.hoisted(() => vi.fn());
const onAuthStateChangeMock = vi.hoisted(() =>
  vi.fn((callback: (event: string, session: Session | null) => void) => {
    authStateChangeHandlerRef.current = callback;
    return { data: { subscription: { unsubscribe: unsubscribeMock } } };
  })
);
const createClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
    },
  }))
);

vi.mock("@shared/lib/supabase/client", () => ({
  __esModule: true,
  createClient: createClientMock,
}));

const mockGetSession = vi.hoisted(() => vi.fn());
const mockFetchUserByContact = vi.hoisted(() => vi.fn());
const mockFetchCubidDataFromSupabase = vi.hoisted(() => vi.fn());

vi.mock("../services/supabaseService", () => ({
  __esModule: true,
  fetchUserByContact: mockFetchUserByContact,
  fetchCubidDataFromSupabase: mockFetchCubidDataFromSupabase,
  getSession: mockGetSession,
  signOut: vi.fn(),
  updateCubidDataInSupabase: vi.fn(),
}));

vi.mock("../services/cubidService", () => ({
  __esModule: true,
  fetchCubidData: vi.fn(),
}));

import { useAuth } from "./useAuth";

const createTestSession = (): Session =>
  ({
    access_token: "access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-token",
    user: {
      id: "user-id",
      aud: "authenticated",
      email: "user@example.com",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  } as unknown as Session);

const baseCubidData = {
  full_name: "Test User",
  username: "testuser",
  email: "user@example.com",
  phone: "",
  address: "",
  bio: "",
  profile_image_url: null,
  preferred_donation_amount: 0,
  selected_cause: "",
  good_tip: null,
  default_tip: null,
  persona: null,
  current_step: 0,
  category: "",
  updated_at: new Date().toISOString(),
};

describe("useAuth", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    authStateChangeHandlerRef.current = null;
    createClientMock.mockClear();
    onAuthStateChangeMock.mockClear();
    unsubscribeMock.mockClear();
    mockGetSession.mockReset();
    mockFetchUserByContact.mockReset();
    mockFetchCubidDataFromSupabase.mockReset();

    mockGetSession.mockResolvedValue(null);
    mockFetchUserByContact.mockResolvedValue({
      user: { cubid_id: "cubid-id", has_completed_intro: true },
      error: null,
    });
    mockFetchCubidDataFromSupabase.mockResolvedValue(baseCubidData);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("sets the user as authenticated when Supabase emits a sign-in event", async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(onAuthStateChangeMock).toHaveBeenCalled();
      expect(typeof authStateChangeHandlerRef.current).toBe("function");
    });

    act(() => {
      authStateChangeHandlerRef.current?.("SIGNED_IN", createTestSession());
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await waitFor(() => {
      expect(mockFetchUserByContact).toHaveBeenCalled();
    });

    unmount();
  });

  it("cleans up the Supabase auth subscription on unmount", async () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(onAuthStateChangeMock).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
