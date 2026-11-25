import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTorontoCoinWalletRuntimeOrThrowMock } = vi.hoisted(() => ({
  getTorontoCoinWalletRuntimeOrThrowMock: vi.fn(),
}));

const { createPublicClientMock, httpMock, readContractMock } = vi.hoisted(() => {
  const readContract = vi.fn();
  const createPublicClient = vi.fn(() => ({ readContract }));
  const http = vi.fn((url: string) => ({ url }));

  return {
    createPublicClientMock: createPublicClient,
    httpMock: http,
    readContractMock: readContract,
  };
});

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  TORONTOCOIN_RUNTIME: {
    chainId: 42220,
    cplTcoin: { address: "0x1111111111111111111111111111111111111111", decimals: 6 },
    rpcUrl: "https://forno.celo.org",
  },
  getTorontoCoinWalletRuntimeOrThrow: getTorontoCoinWalletRuntimeOrThrowMock,
}));

vi.mock("viem", () => ({
  createPublicClient: createPublicClientMock,
  http: httpMock,
  formatUnits: (value: bigint, decimals: number) => {
    const normalized = Number(value) / 10 ** decimals;
    return Number.isInteger(normalized) ? String(normalized) : String(normalized);
  },
}));

import { useTokenBalance } from "./useTokenBalance";

describe("useTokenBalance", () => {
  beforeEach(() => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockReset();
    createPublicClientMock.mockClear();
    httpMock.mockClear();
    readContractMock.mockReset();
  });

  it("reads cplTCOIN balance from the TorontoCoin runtime bridge", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockReturnValue({
      cplTcoin: { address: "0x1111111111111111111111111111111111111111", decimals: 6 },
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
    });
    readContractMock.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") {
        return BigInt(1000000);
      }

      if (functionName === "decimals") {
        return 6;
      }

      return 0;
    });

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );

    await waitFor(() => {
      expect(result.current.balance).toBe("1");
    });

    expect(createPublicClientMock).toHaveBeenCalledWith({
      transport: { url: "https://forno.celo.org" },
    });
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x1111111111111111111111111111111111111111",
        functionName: "balanceOf",
        args: ["0x00000000000000000000000000000000000000aa"],
      })
    );
  });

  it("surfaces fail-closed Preview runtime errors without making an RPC call", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockImplementation(() => {
      throw new Error("Preview wallet runtime is not configured.");
    });

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );

    await waitFor(() => {
      expect(result.current.error).toBe("Preview wallet runtime is not configured.");
    });
    expect(createPublicClientMock).not.toHaveBeenCalled();
  });
});
