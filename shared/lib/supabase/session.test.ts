import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("session snapshot helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not persist the shared session snapshot on the server", async () => {
    vi.stubGlobal("window", undefined);

    const { getAccessTokenSnapshot, getSessionSnapshot, resolveSessionSnapshot, setSessionSnapshot } =
      await import("./session");
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "server-token" } },
    });
    const client = {
      auth: {
        getSession,
      },
    } as never;

    setSessionSnapshot({ access_token: "browser-only-token" } as never);
    expect(getSessionSnapshot()).toBeNull();
    expect(getAccessTokenSnapshot()).toBeNull();

    const resolvedSession = await resolveSessionSnapshot(client);
    expect(resolvedSession).toEqual({ access_token: "server-token" });
    expect(getSessionSnapshot()).toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
