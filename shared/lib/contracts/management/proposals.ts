// @ts-nocheck
import { stringToHex, type Hex } from "viem";
import { votingV2Abi } from "@shared/lib/contracts/management/abis";
import {
  getCityContext,
  getCityPublicClient,
  writeCityContractWithCubid,
} from "@shared/lib/contracts/management/clients";

function toProposalStatus(status: number) {
  switch (status) {
    case 0:
      return "PENDING";
    case 1:
      return "APPROVED";
    case 2:
      return "REJECTED";
    case 3:
      return "EXECUTED";
    case 4:
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function toProposalType(kind: number) {
  return kind === 1 ? "RESERVE_CURRENCY" : "CHARITY";
}

function toBytes32Code(code: string): Hex {
  return stringToHex(code, { size: 32 });
}

export async function getProposal({ citySlug, proposalId }: { citySlug?: string; proposalId: number }) {
  const context = await getCityContext(citySlug);
  const client = getCityPublicClient(context.chainId);

  const proposal = (await client.readContract({
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
  })) as any;

  return {
    proposalId: Number(proposal.proposalId),
    proposalType: toProposalType(Number(proposal.proposalType)),
    cityId: proposal.cityId,
    charityId: Number(proposal.charityId),
    name: proposal.name,
    wallet: proposal.wallet,
    code: proposal.code,
    token: proposal.token,
    decimals: Number(proposal.decimals),
    metadataRecordId: proposal.metadataRecordId,
    yesVotes: Number(proposal.yesVotes),
    noVotes: Number(proposal.noVotes),
    deadline: Number(proposal.deadline),
    status: toProposalStatus(Number(proposal.status)),
    proposer: proposal.proposer,
  };
}

export async function getProposalCount({ citySlug }: { citySlug?: string } = {}) {
  const context = await getCityContext(citySlug);
  const client = getCityPublicClient(context.chainId);
  const count = (await client.readContract({
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "proposalCount",
    args: [],
  })) as bigint;
  return Number(count);
}

export async function listProposalIdsByStatus({
  citySlug,
  status,
  cursor,
  size,
}: {
  citySlug?: string;
  status: number;
  cursor: number;
  size: number;
}) {
  const context = await getCityContext(citySlug);
  const client = getCityPublicClient(context.chainId);

  const response = (await client.readContract({
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "listProposalIdsByStatus",
    args: [status, BigInt(cursor), BigInt(size)],
  })) as readonly [readonly bigint[], bigint];

  return {
    ids: response[0].map((v) => Number(v)),
    nextCursor: Number(response[1]),
  };
}

export async function proposePegValue({
  citySlug,
  userId,
  proposedPegValue,
  votingWindowSeconds,
}: {
  citySlug?: string;
  userId: number;
  proposedPegValue: number;
  votingWindowSeconds: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "proposePegValue",
    args: [BigInt(proposedPegValue), votingWindowSeconds],
  });
}

export async function votePegValue({
  citySlug,
  userId,
  proposedPegValue,
}: {
  citySlug?: string;
  userId: number;
  proposedPegValue: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "votePegValue",
    args: [BigInt(proposedPegValue)],
  });
}

export async function proposeCharity({
  citySlug,
  userId,
  charityId,
  name,
  wallet,
  metadataRecordId,
  votingWindowSeconds,
}: {
  citySlug?: string;
  userId: number;
  charityId: number;
  name: string;
  wallet: `0x${string}`;
  metadataRecordId: string;
  votingWindowSeconds: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "proposeCharity",
    args: [BigInt(charityId), name, wallet, metadataRecordId, votingWindowSeconds],
  });
}

export async function proposeReserveCurrency({
  citySlug,
  userId,
  code,
  token,
  decimals,
  metadataRecordId,
  votingWindowSeconds,
}: {
  citySlug?: string;
  userId: number;
  code: string;
  token: `0x${string}`;
  decimals: number;
  metadataRecordId: string;
  votingWindowSeconds: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "proposeReserveCurrency",
    args: [toBytes32Code(code), token, decimals, metadataRecordId, votingWindowSeconds],
  });
}

export async function voteProposal({
  citySlug,
  userId,
  proposalId,
  support,
}: {
  citySlug?: string;
  userId: number;
  proposalId: number;
  support: boolean;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "voteProposal",
    args: [BigInt(proposalId), support],
  });
}

export async function executeProposal({
  citySlug,
  userId,
  proposalId,
}: {
  citySlug?: string;
  userId: number;
  proposalId: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "executeProposal",
    args: [BigInt(proposalId)],
  });
}

export async function cancelProposal({
  citySlug,
  userId,
  proposalId,
}: {
  citySlug?: string;
  userId: number;
  proposalId: number;
}) {
  const context = await getCityContext(citySlug);
  return writeCityContractWithCubid({
    citySlug,
    userId,
    address: context.contracts.VOTING,
    abi: votingV2Abi,
    functionName: "cancelProposal",
    args: [BigInt(proposalId)],
  });
}
