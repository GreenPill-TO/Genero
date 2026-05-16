/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockIsLocalOrDevelopmentEnvironment: vi.fn(),
}));

vi.mock("@shared/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: h.mockGetUser,
    },
  }),
}));

vi.mock("@shared/lib/bia/apiAuth", () => ({
  isLocalOrDevelopmentEnvironment: h.mockIsLocalOrDevelopmentEnvironment,
}));

import { POST } from "./route";

describe("POST /api/merchant/geocode", () => {
  beforeEach(() => {
    h.mockGetUser.mockReset();
    h.mockIsLocalOrDevelopmentEnvironment.mockReset();
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
  });

  it("requires an authenticated user outside local/development environments", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(
      new Request("http://localhost/api/merchant/geocode", {
        method: "POST",
        body: JSON.stringify({ address: "123 Queen St W" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("geocodes with request-scoped auth and returns the resolved city slug", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(false);
    h.mockGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "43.6532",
            lon: "-79.3832",
            display_name: "Toronto, Ontario, Canada",
            place_id: 1234,
          },
        ]),
        { status: 200 }
      )
    );

    const response = await POST(
      new Request("http://localhost/api/merchant/geocode", {
        method: "POST",
        body: JSON.stringify({ address: "Toronto", citySlug: "tcoin" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      citySlug: "tcoin",
      normalizedAddress: "Toronto, Ontario, Canada",
      lat: 43.6532,
      lng: -79.3832,
      placeId: 1234,
    });
  });

  it("redacts Supabase client configuration errors", async () => {
    h.mockIsLocalOrDevelopmentEnvironment.mockReturnValue(true);
    h.mockGetUser.mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));

    const response = await POST(
      new Request("http://localhost/api/merchant/geocode", {
        method: "POST",
        body: JSON.stringify({ address: "Toronto" }),
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Merchant geocoding is not configured for this environment.",
    });
  });
});
