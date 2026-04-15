import { stringToHex, type Hex } from "viem";
import { votingV2Abi } from "@shared/lib/contracts/management/abis";
import { getCityContext } from "@shared/lib/contracts/management/clients";
import { writeCityContractWithCubid } from "@shared/lib/contracts/management/writes";

function toBytes32Code(code: string): Hex {
  return stringToHex(code, { size: 32 });
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
