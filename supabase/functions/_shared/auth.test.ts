/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn(() => ({ auth: {}, rpc: rpcMock })));
const denoEnv = vi.hoisted(() => {
  const env = {
    get(name: string) {
      return {
        SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      }[name];
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
  resolveAuthenticatedEdgeContext,
  resolveAuthenticatedEdgeUser,
} from "./auth";

describe("edge auth client boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).Deno = { env: denoEnv };
    rpcMock.mockReset();
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
});
