/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerIndexerTouch } from "./trigger";

describe("triggerIndexerTouch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete process.env.NEXT_PUBLIC_CITYCOIN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("treats a 202 queued touch response as success and records local cooldown", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          scopeKey: "tcoin:42220",
          started: true,
          queued: true,
          skipped: false,
          runStatus: "queued",
          requestId: 21,
        }),
        { status: 202 }
      )
    );

    const result = await triggerIndexerTouch({
      citySlug: "tcoin",
      bypassLocalCooldown: true,
    });

    expect(result).toMatchObject({
      queued: true,
      runStatus: "queued",
      requestId: 21,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = await triggerIndexerTouch({ citySlug: "tcoin" });
    expect(cached).toMatchObject({
      queued: false,
      skipped: true,
      reason: "client_cooldown",
    });
  });
});
