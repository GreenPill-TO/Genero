import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getActiveCityContractsMock, getRpcUrlForChainIdMock } = vi.hoisted(() => ({
  getActiveCityContractsMock: vi.fn(),
  getRpcUrlForChainIdMock: vi.fn(),
}));

const { getTorontoCoinRuntimeConfigMock } = vi.hoisted(() => ({
  getTorontoCoinRuntimeConfigMock: vi.fn(),
}));

const { balanceCallMock, balanceOfMock, decimalsCallMock, decimalsMock, contractCtorMock } = vi.hoisted(() => {
  const balanceCall = vi.fn();
  const balanceOf = vi.fn(() => ({ call: balanceCall }));
  const decimalsCall = vi.fn();
  const decimals = vi.fn(() => ({ call: decimalsCall }));
  const contractCtor = vi.fn(() => ({ methods: { balanceOf, decimals } }));

  return {
    balanceCallMock: balanceCall,
    balanceOfMock: balanceOf,
    decimalsCallMock: decimalsCall,
    decimalsMock: decimals,
    contractCtorMock: contractCtor,
  };
});

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: getActiveCityContractsMock,
  getRpcUrlForChainId: getRpcUrlForChainIdMock,
}));

vi.mock("@shared/lib/contracts/torontocoinRuntime", () => ({
  TORONTOCOIN_RUNTIME: {
    chainId: 42220,
    cplTcoin: { address: "0x1111111111111111111111111111111111111111", decimals: 6 },
    rpcUrl: "https://forno.celo.org",
  },
  getTorontoCoinRuntimeConfig: getTorontoCoinRuntimeConfigMock,
}));

vi.mock("web3", () => {
  class MockWeb3 {
    static providers = {
      HttpProvider: vi.fn((url: string) => ({ url })),
    };

    eth = {
      Contract: contractCtorMock,
    };

    constructor(_: unknown) {}
  }

  return { default: MockWeb3 };
});

import { useTokenBalance } from "./useTokenBalance";

describe("useTokenBalance", () => {
  beforeEach(() => {
    getActiveCityContractsMock.mockReset();
    getRpcUrlForChainIdMock.mockReset();
    getTorontoCoinRuntimeConfigMock.mockReset();
    balanceCallMock.mockReset();
    balanceOfMock.mockClear();
    decimalsCallMock.mockReset();
    decimalsMock.mockClear();
    contractCtorMock.mockClear();
  });

  it("reads cplTCOIN balance from the TorontoCoin runtime bridge", async () => {
    getTorontoCoinRuntimeConfigMock.mockReturnValue({
      cplTcoin: { address: "0x1111111111111111111111111111111111111111", decimals: 6 },
      rpcUrl: "https://forno.celo.org",
      chainId: 42220,
    });
    balanceCallMock.mockResolvedValue("1000000");
    decimalsCallMock.mockResolvedValue("6");

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );

    await waitFor(() => {
      expect(result.current.balance).toBe("1");
    });

    expect(contractCtorMock).toHaveBeenCalledWith(
      expect.anything(),
      "0x1111111111111111111111111111111111111111"
    );
    expect(balanceOfMock).toHaveBeenCalledWith("0x00000000000000000000000000000000000000aa");
  });

  it("falls back to registry-resolved legacy contracts outside the TorontoCoin runtime", async () => {
    getTorontoCoinRuntimeConfigMock.mockReturnValue(null);
    getActiveCityContractsMock.mockResolvedValue({
      chainId: 545,
      contracts: { TCOIN: "0x0000000000000000000000000000000000000001" },
    });
    getRpcUrlForChainIdMock.mockReturnValue("https://testnet.evm.nodes.onflow.org");
    balanceCallMock.mockResolvedValue("1000000000000000000");
    decimalsCallMock.mockResolvedValue("18");

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );

    await waitFor(() => {
      expect(result.current.balance).toBe("1");
    });

    expect(getActiveCityContractsMock).toHaveBeenCalledTimes(1);
    expect(getRpcUrlForChainIdMock).toHaveBeenCalledWith(545);
    expect(contractCtorMock).toHaveBeenCalledWith(
      expect.anything(),
      "0x0000000000000000000000000000000000000001"
    );
    expect(balanceOfMock).toHaveBeenCalledWith("0x00000000000000000000000000000000000000aa");
  });

  it("surfaces registry resolution errors", async () => {
    getTorontoCoinRuntimeConfigMock.mockReturnValue(null);
    getActiveCityContractsMock.mockRejectedValue(
      new Error("City registry bootstrap address is not configured.")
    );

    const { result } = renderHook(() =>
      useTokenBalance("0x00000000000000000000000000000000000000aa")
    );

    await waitFor(() => {
      expect(result.current.error).toBe("City registry bootstrap address is not configured.");
    });
  });
});
