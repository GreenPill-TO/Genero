/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockRunIndexerTouch: vi.fn(),
}));

vi.mock("./index", () => ({
  runIndexerTouch: h.mockRunIndexerTouch,
}));

import { drainIndexerTouchQueueOnce } from "./touchQueue";

describe("drainIndexerTouchQueueOnce", () => {
  beforeEach(() => {
    h.mockRunIndexerTouch.mockReset();
  });

  it("no-ops cleanly when the queue is empty", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const schema = vi.fn().mockReturnValue({ rpc });

    const result = await drainIndexerTouchQueueOnce({
      supabase: { schema, rpc } as never,
    });

    expect(result).toEqual({
      processed: false,
      request: null,
      result: null,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("requires the worker boundary to pass a scoped service-role client", async () => {
    await expect(
      drainIndexerTouchQueueOnce(undefined as unknown as Parameters<typeof drainIndexerTouchQueueOnce>[0])
    ).rejects.toThrow("A scoped service-role Supabase client is required to drain indexer touch requests.");
  });

  it("claims a queued request, runs the indexer, and marks success", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          requestId: 7,
          scopeKey: "tcoin:42220",
          citySlug: "tcoin",
          chainId: 42220,
          source: "next-api",
          requestedAt: "2026-04-26T12:00:00.000Z",
          claimedAt: "2026-04-26T12:00:01.000Z",
          attemptCount: 1,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });
    const schema = vi.fn().mockReturnValue({ rpc });

    h.mockRunIndexerTouch.mockResolvedValue({
      scopeKey: "tcoin:42220",
      started: true,
      skipped: false,
      runStatus: "success",
    });

    const result = await drainIndexerTouchQueueOnce({
      supabase: { schema, rpc } as never,
    });

    expect(h.mockRunIndexerTouch).toHaveBeenCalledWith({
      supabase: { schema, rpc },
      citySlug: "tcoin",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_touch_request_v1", {
      p_request_id: 7,
      p_status: "completed",
      p_run_status: "success",
      p_error: null,
    });
    expect(result).toMatchObject({
      processed: true,
      request: {
        requestId: 7,
        citySlug: "tcoin",
      },
      result: {
        runStatus: "success",
      },
    });
  });

  it("marks failure when the indexer throws after claiming a request", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          requestId: 9,
          scopeKey: "tcoin:42220",
          citySlug: "tcoin",
          chainId: 42220,
          source: "next-api",
          requestedAt: "2026-04-26T12:00:00.000Z",
          claimedAt: "2026-04-26T12:00:01.000Z",
          attemptCount: 1,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });
    const schema = vi.fn().mockReturnValue({ rpc });

    h.mockRunIndexerTouch.mockRejectedValue(new Error("boom"));

    await expect(
      drainIndexerTouchQueueOnce({
        supabase: { schema, rpc } as never,
      })
    ).rejects.toThrow("boom");

    expect(rpc).toHaveBeenNthCalledWith(2, "complete_touch_request_v1", {
      p_request_id: 9,
      p_status: "failed",
      p_run_status: "error",
      p_error: "boom",
    });
  });
});
