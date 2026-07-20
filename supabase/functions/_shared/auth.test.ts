/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn(() => ({ auth: { getUser: getUserMock }, rpc: rpcMock })));
const denoEnvValues = vi.hoisted(() => ({
  SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
} as Record<string, string | undefined>));
const denoEnv = vi.hoisted(() => {
  const env = {
    get(name: string) {
      return denoEnvValues[name];
    },
  };
  (globalThis as any).Deno = { env };
  return env;
});

vi.mock("https://esm.sh/@supabase/supabase-js@2.45.6", () => ({
  createClient: createClientMock,
}));

import {
  createAuthenticatedRequestClient,
  createServiceRoleClient,
  resolveAuthenticatedEdgeAuthUser,
  resolveAuthenticatedEdgeContext,
  resolveAuthenticatedEdgeUser,
} from "./auth";

describe("edge auth client boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    denoEnvValues.SUPABASE_URL = "https://project.supabase.co";
    denoEnvValues.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    denoEnvValues.SUPABASE_PUBLISHABLE_KEYS = undefined;
    denoEnvValues.SUPABASE_PUBLISHABLE_KEY = undefined;
    denoEnvValues.SUPABASE_ANON_KEY = undefined;
    denoEnvValues.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    (globalThis as any).Deno = { env: denoEnv };
    rpcMock.mockReset();
    getUserMock.mockReset();
  });

  it("creates request-scoped clients with the publishable key and caller bearer token", () => {
    const req = new Request("http://localhost/functions/v1/test", {
      headers: { authorization: "Bearer caller-token" },
    });

    createAuthenticatedRequestClient(req, { purpose: "unit test scoped read" });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test",
      expect.objectContaining({
        global: {
          headers: {
            Authorization: "Bearer caller-token",
          },
        },
      })
    );
  });

  it("uses Supabase's hosted publishable-key dictionary when no custom canonical secret is set", () => {
    denoEnvValues.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = undefined;
    denoEnvValues.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({
      default: {
        api_key: "sb_publishable_hosted_default",
      },
    });

    createAuthenticatedRequestClient(
      new Request("http://localhost/functions/v1/test", {
        headers: { authorization: "Bearer caller-token" },
      }),
      { purpose: "unit test hosted scoped read" }
    );

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_hosted_default",
      expect.any(Object)
    );
  });

  it("falls back to the platform anon key only when publishable keys are unavailable", () => {
    denoEnvValues.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = undefined;
    denoEnvValues.SUPABASE_PUBLISHABLE_KEYS = undefined;
    denoEnvValues.SUPABASE_ANON_KEY = "legacy-anon-key";

    createAuthenticatedRequestClient(
      new Request("http://localhost/functions/v1/test", {
        headers: { authorization: "Bearer caller-token" },
      }),
      { purpose: "unit test legacy scoped read" }
    );

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "legacy-anon-key",
      expect.any(Object)
    );
  });

  it("requires explicit purpose labels for privileged service-role clients", () => {
    expect(() => createServiceRoleClient()).toThrow("service-role purpose");
  });

  it("resolves request user and app context through scoped RPCs", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{ id: 21, email: "person@example.test", auth_user_id: "auth-1", cubid_id: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          appSlug: "wallet",
          citySlug: "tcoin",
          environment: "development",
          appInstanceId: 7,
        },
        error: null,
      });

    const result = await resolveAuthenticatedEdgeContext(
      new Request("http://localhost/functions/v1/test", {
        headers: { authorization: "Bearer caller-token" },
      }),
      {
        purpose: "unit test scoped edge context",
        input: { appSlug: "wallet", citySlug: "tcoin", environment: "development" },
      }
    );

    expect(result.userRow.id).toBe(21);
    expect(result.appContext).toEqual({
      appSlug: "wallet",
      citySlug: "tcoin",
      environment: "development",
      appInstanceId: 7,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "edge_resolve_current_user_v1");
    expect(rpcMock).toHaveBeenNthCalledWith(2, "edge_resolve_app_context_v1", {
      p_app_slug: "wallet",
      p_city_slug: "tcoin",
      p_environment: "development",
    });
  });

  it("can resolve only the authenticated app user through the scoped RPC boundary", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ id: 22, email: "reader@example.test", auth_user_id: "auth-2", cubid_id: null }],
      error: null,
    });

    const result = await resolveAuthenticatedEdgeUser(
      new Request("http://localhost/functions/v1/test", {
        headers: { authorization: "Bearer caller-token" },
      }),
      { purpose: "unit test scoped edge user" }
    );

    expect(result.userRow.id).toBe(22);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("edge_resolve_current_user_v1");
  });

  it("can resolve the Supabase auth user through the request-scoped auth client", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "auth-3", email: "writer@example.test", phone: null } },
      error: null,
    });

    const result = await resolveAuthenticatedEdgeAuthUser(
      new Request("http://localhost/functions/v1/test", {
        headers: { authorization: "Bearer caller-token" },
      }),
      { purpose: "unit test scoped auth user" }
    );

    expect(result.authUser.id).toBe("auth-3");
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "sb_publishable_test",
      expect.objectContaining({
        global: {
          headers: {
            Authorization: "Bearer caller-token",
          },
        },
      })
    );
  });
});
