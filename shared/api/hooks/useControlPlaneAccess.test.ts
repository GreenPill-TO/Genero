import { describe, expect, it, vi } from "vitest";

const useQueryMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    useQueryMock(options);
    return { data: null };
  },
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

import { useControlPlaneAccess } from "./useControlPlaneAccess";

describe("useControlPlaneAccess", () => {
  it("keys the access query by authenticated user id", () => {
    useAuthMock.mockReturnValue({
      authData: {
        user: {
          id: "user-123",
        },
      },
    });

    useControlPlaneAccess("tcoin");

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["control-plane-access", "tcoin", "user-123"],
      })
    );
  });
});
