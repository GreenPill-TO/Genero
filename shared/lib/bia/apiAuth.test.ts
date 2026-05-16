import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

type AuthStub = {
  getUserMock: MockFn;
  createClientMock: MockFn;
  maybeSingleMock: MockFn;
  limitMock: MockFn;
  eqMock: MockFn;
  selectMock: MockFn;
  fromMock: MockFn;
  createServiceRoleClientMock: MockFn;
  resolveUserRowMock: MockFn;
  configure: () => void;
};

const authStub = vi.hoisted<AuthStub>(() => {
  const getUserMock = vi.fn();
  const createClientMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const limitMock = vi.fn();
  const eqMock = vi.fn();
  const selectMock = vi.fn();
  const fromMock = vi.fn();
  const createServiceRoleClientMock = vi.fn();
  const resolveUserRowMock = vi.fn();

  let queryBuilder: {
    select: MockFn;
    eq: MockFn;
    limit: MockFn;
    maybeSingle: MockFn;
  } | null = null;

  const configure = () => {
    queryBuilder = {
      select: selectMock,
      eq: eqMock,
      limit: limitMock,
      maybeSingle: maybeSingleMock,
    };

    selectMock.mockImplementation(() => queryBuilder);
    eqMock.mockImplementation(() => queryBuilder);
    limitMock.mockImplementation(() => queryBuilder);
    fromMock.mockImplementation(() => queryBuilder);
    createServiceRoleClientMock.mockReturnValue({ from: fromMock });
    createClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  };

  configure();

  return {
    getUserMock,
    createClientMock,
    maybeSingleMock,
    limitMock,
    eqMock,
    selectMock,
    fromMock,
    createServiceRoleClientMock,
    resolveUserRowMock,
    configure,
  } satisfies AuthStub;
});

vi.mock("@shared/lib/supabase/server", () => {
  authStub.configure();
  return {
    createClient: authStub.createClientMock,
  };
});

vi.mock("@shared/lib/supabase/serviceRole", () => {
  authStub.configure();
  return {
    createServiceRoleClient: authStub.createServiceRoleClientMock,
  };
});

vi.mock("@shared/lib/bia/server", () => ({
  resolveUserRow: authStub.resolveUserRowMock,
}));

import { resolveApiAuthContext } from "./apiAuth";

function clearMocks() {
  authStub.getUserMock.mockReset();
  authStub.createClientMock.mockReset();
  authStub.maybeSingleMock.mockReset();
  authStub.limitMock.mockReset();
  authStub.eqMock.mockReset();
  authStub.selectMock.mockReset();
  authStub.fromMock.mockReset();
  authStub.createServiceRoleClientMock.mockReset();
  authStub.resolveUserRowMock.mockReset();
  authStub.configure();
}

describe("resolveApiAuthContext", () => {
  beforeEach(() => {
    clearMocks();
    delete process.env.AUTH_BYPASS_USER_ID;
    delete process.env.NEXT_PUBLIC_APP_ENVIRONMENT;
  });

  afterEach(() => {
    delete process.env.AUTH_BYPASS_USER_ID;
    delete process.env.NEXT_PUBLIC_APP_ENVIRONMENT;
  });

  it("rejects unauthenticated requests outside local or development", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "production";
    authStub.getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(resolveApiAuthContext()).rejects.toThrow("Unauthorized");
  });

  it("requires an explicit bypass user id in local development", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "local";
    authStub.getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(resolveApiAuthContext()).rejects.toThrow(
      "AUTH_BYPASS_USER_ID must be set to a positive public.users.id in local or development."
    );
    expect(authStub.fromMock).not.toHaveBeenCalled();
  });

  it("resolves the configured bypass user row in local development", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "development";
    process.env.AUTH_BYPASS_USER_ID = "1001";
    authStub.getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    authStub.maybeSingleMock.mockResolvedValue({
      data: { id: 1001, email: "hubert.cormac@gmail.com", auth_user_id: "seed-auth-user-1001", is_admin: true },
      error: null,
    });

    const result = await resolveApiAuthContext();

    expect(result.authBypassed).toBe(true);
    expect(result.userRow.id).toBe(1001);
    expect(result.authUser.email).toBe("hubert.cormac@gmail.com");
    expect(authStub.fromMock).toHaveBeenCalledWith("users");
    expect(authStub.eqMock).toHaveBeenCalledWith("id", 1001);
  });

  it("uses the real authenticated user when a Supabase session exists", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "production";
    authStub.getUserMock.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "hubert.cormac@gmail.com" } },
      error: null,
    });
    authStub.resolveUserRowMock.mockResolvedValue({
      id: 1001,
      email: "hubert.cormac@gmail.com",
      auth_user_id: "auth-user-1",
      is_admin: true,
    });

    const result = await resolveApiAuthContext();

    expect(result.authBypassed).toBe(false);
    expect(result.authUser.id).toBe("auth-user-1");
    expect(authStub.resolveUserRowMock).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      authUserId: "auth-user-1",
      email: "hubert.cormac@gmail.com",
    });
  });
});
