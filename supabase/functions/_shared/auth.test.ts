/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({ auth: {}, rpc: vi.fn() })));
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

import { createAuthenticatedRequestClient, createServiceRoleClient } from "./auth";

describe("edge auth client boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).Deno = { env: denoEnv };
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
});
