import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getActiveCityContractsMock, getRpcUrlForChainIdMock } = vi.hoisted(() => ({
  getActiveCityContractsMock: vi.fn(),
  getRpcUrlForChainIdMock: vi.fn(),
}));

const { balanceCallMock, balanceOfMock, contractCtorMock, fromWeiMock } = vi.hoisted(() => {
  const balanceCall = vi.fn();
  const balanceOf = vi.fn(() => ({ call: balanceCall }));
  const contractCtor = vi.fn(() => ({ methods: { balanceOf } }));
  const fromWei = vi.fn();

  return {
    balanceCallMock: balanceCall,
    balanceOfMock: balanceOf,
    contractCtorMock: contractCtor,
    fromWeiMock: fromWei,
  };
});

vi.mock("@shared/lib/contracts/cityContracts", () => ({
  getActiveCityContracts: getActiveCityContractsMock,
  getRpcUrlForChainId: getRpcUrlForChainIdMock,
}));

vi.mock("web3", () => {
  class MockWeb3 {
    static providers = {
      HttpProvider: vi.fn((url: string) => ({ url })),
    };

    eth = {
      Contract: contractCtorMock,
    };

    utils = {
      fromWei: fromWeiMock,
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
    balanceCallMock.mockReset();
    balanceOfMock.mockClear();
    contractCtorMock.mockClear();
    fromWeiMock.mockReset();
  });

  it("reads token balance using registry-resolved chain and contract address", async () => {
    getActiveCityContractsMock.mockResolvedValue({
      chainId: 545,
      contracts: { TCOIN: "0x0000000000000000000000000000000000000001" },
    });
    getRpcUrlForChainIdMock.mockReturnValue("https://testnet.evm.nodes.onflow.org");
    balanceCallMock.mockResolvedValue("1000000000000000000");
    fromWeiMock.mockReturnValue("1");

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
