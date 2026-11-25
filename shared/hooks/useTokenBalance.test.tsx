import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTorontoCoinWalletRuntimeOrThrowMock, assertTokenIdentityMock } = vi.hoisted(() => ({
  getTorontoCoinWalletRuntimeOrThrowMock: vi.fn(),
  assertTokenIdentityMock: vi.fn(),
}));

const { createPublicClientMock, httpMock, readContractMock, getChainIdMock, getBytecodeMock } = vi.hoisted(() => {
  const readContract = vi.fn();
  const getChainId = vi.fn();
  const getBytecode = vi.fn();
  const createPublicClient = vi.fn(() => ({ readContract, getChainId, getBytecode }));
  const http = vi.fn((url: string) => ({ url }));

  return {
    createPublicClientMock: createPublicClient,
    httpMock: http,
    readContractMock: readContract,
    getChainIdMock: getChainId,
    getBytecodeMock: getBytecode,
  };
});

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  TORONTOCOIN_RUNTIME: {
    chainId: 42220,
    cplTcoin: { address: "0x1111111111111111111111111111111111111111", decimals: 6 },
    rpcUrl: "https://forno.celo.org",
  },
  getTorontoCoinWalletRuntimeOrThrow: getTorontoCoinWalletRuntimeOrThrowMock,
  assertTorontoCoinWalletTokenIdentity: assertTokenIdentityMock,
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
    getChainIdMock.mockReset();
    getBytecodeMock.mockReset();
    assertTokenIdentityMock.mockReset();
    getChainIdMock.mockResolvedValue(42220);
    getBytecodeMock.mockResolvedValue("0x6000");
  });

  it("reads cplTCOIN balance from the TorontoCoin runtime bridge", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockReturnValue({
      cplTcoin: {
        address: "0x1111111111111111111111111111111111111111",
        decimals: 6,
        name: "Cross Pool Liquidity TCOIN",
        symbol: "cplTCOIN",
      },
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

      if (functionName === "name") return "Cross Pool Liquidity TCOIN";
      if (functionName === "symbol") return "cplTCOIN";

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
    const balanceCallIndex = readContractMock.mock.calls.findIndex(
      (call) => call[0].functionName === "balanceOf"
    );
    expect(assertTokenIdentityMock.mock.invocationCallOrder[0]).toBeLessThan(
      readContractMock.mock.invocationCallOrder[balanceCallIndex]
    );
  });

  it("does not read a balance when chain or live token identity validation fails", async () => {
    getTorontoCoinWalletRuntimeOrThrowMock.mockReturnValue({
      cplTcoin: {
        address: "0x1111111111111111111111111111111111111111",
        decimals: 6,
        name: "Cross Pool Liquidity TCOIN",
        symbol: "cplTCOIN",
      },
      rpcUrl: "https://preview.example",
      chainId: 11142220,
    });
    getChainIdMock.mockResolvedValue(42220);
    readContractMock.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === "decimals") return 18;
      if (functionName === "name") return "Generic Token";
      if (functionName === "symbol") return "ERC20";
      throw new Error(`unexpected ${functionName}`);
    });
    assertTokenIdentityMock.mockImplementation(() => {
      throw new Error("Wallet RPC chain mismatch: expected 11142220, received 42220.");
    });

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );
    await waitFor(() => expect(result.current.error).toContain("expected 11142220"));
    expect(readContractMock.mock.calls.some((call) => call[0].functionName === "balanceOf")).toBe(false);
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
