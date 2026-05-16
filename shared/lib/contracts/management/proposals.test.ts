import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCityContextMock, getCityPublicClientMock, writeCityContractWithCubidMock } = vi.hoisted(() => ({
  getCityContextMock: vi.fn(),
  getCityPublicClientMock: vi.fn(),
  writeCityContractWithCubidMock: vi.fn(),
}));

vi.mock("@shared/lib/contracts/management/clients", () => ({
  getCityContext: getCityContextMock,
  getCityPublicClient: getCityPublicClientMock,
}));

vi.mock("@shared/lib/contracts/management/writes", () => ({
  writeCityContractWithCubid: writeCityContractWithCubidMock,
}));

import { getProposal, listProposalIdsByStatus } from "./proposals";
import { proposeReserveCurrency, voteProposal } from "./proposals-write";

describe("management proposals client", () => {
  beforeEach(() => {
    getCityContextMock.mockReset();
    getCityPublicClientMock.mockReset();
    writeCityContractWithCubidMock.mockReset();

    getCityContextMock.mockResolvedValue({
      contracts: { VOTING: "0x0000000000000000000000000000000000000009" },
      chainId: 545,
    });
  });

  it("maps getProposal contract tuple into UI view model", async () => {
    const readContract = vi.fn().mockResolvedValue({
      proposalId: BigInt(7),
      proposalType: 1,
      cityId: "0x" + "11".repeat(32),
      charityId: BigInt(0),
      name: "",
      wallet: "0x0000000000000000000000000000000000000001",
      code: "0x" + "22".repeat(32),
      token: "0x0000000000000000000000000000000000000002",
      decimals: 6,
      metadataRecordId: "meta-7",
      yesVotes: BigInt(4),
      noVotes: BigInt(1),
      deadline: BigInt(1700000000),
      status: 1,
      proposer: "0x0000000000000000000000000000000000000003",
    });

    getCityPublicClientMock.mockReturnValue({ readContract });

    const proposal = await getProposal({ proposalId: 7 });

    expect(proposal.proposalId).toBe(7);
    expect(proposal.proposalType).toBe("RESERVE_CURRENCY");
    expect(proposal.yesVotes).toBe(4);
    expect(proposal.status).toBe("APPROVED");
  });

  it("paginates proposal ids by status", async () => {
    const readContract = vi.fn().mockResolvedValue([
      [BigInt(1), BigInt(3), BigInt(5)],
      BigInt(5),
    ]);
    getCityPublicClientMock.mockReturnValue({ readContract });

    const result = await listProposalIdsByStatus({ status: 0, cursor: 0, size: 10 });
    expect(result.ids).toEqual([1, 3, 5]);
    expect(result.nextCursor).toBe(5);
  });

  it("routes write actions through Cubid signer writer", async () => {
    writeCityContractWithCubidMock.mockResolvedValue({ txHash: "0xabc", chainId: 545 });

    const voteTx = await voteProposal({ userId: 11, proposalId: 3, support: true });
    expect(voteTx.txHash).toBe("0xabc");

    await proposeReserveCurrency({
      userId: 11,
      code: "USDC",
      token: "0x0000000000000000000000000000000000000004",
      decimals: 6,
      metadataRecordId: "meta-usdc",
      votingWindowSeconds: 3600,
    });

    expect(writeCityContractWithCubidMock).toHaveBeenCalledTimes(2);
  });
});
