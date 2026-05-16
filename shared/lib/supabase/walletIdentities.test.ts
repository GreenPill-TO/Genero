import { beforeEach, describe, expect, it, vi } from "vitest";

const inMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn(() => ({ in: inMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: fromMock,
  }),
}));

import { mapUserIdsByWallets } from "./walletIdentities";

describe("mapUserIdsByWallets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalises wallet inputs to lowercase for lookup and preserves caller keys", async () => {
    inMock.mockResolvedValue({
      data: [
        {
          user_id: 42,
          public_key: "0xabc123",
          wallet_key_id: "7",
          wallet_ready: true,
          has_encrypted_share: true,
        },
      ],
      error: null,
    });

    const result = await mapUserIdsByWallets(["0xAbC123"]);

    expect(inMock).toHaveBeenCalledWith("public_key", ["0xabc123"]);
    expect(result.get("0xabc123")).toBe(42);
    expect(result.get("0xAbC123")).toBe(42);
  });
});
