import type { Hex } from "viem";

export type ManagementRole =
  | "GOVERNANCE_STEWARD"
  | "CITY_MANAGER"
  | "TREASURY_ADMIN"
  | "TOKEN_ADMIN"
  | "CHARITY_OPERATOR"
  | "REGISTRY_ADMIN";

export type ProposalType = "CHARITY" | "RESERVE_CURRENCY";

export type ProposalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "CANCELLED";

export type CityContext = {
  citySlug: string;
  cityId: Hex;
  version: number;
  chainId: number;
  metadataURI: string;
  contracts: {
    TCOIN: Hex;
    TTC: Hex;
    CAD: Hex;
    ORCHESTRATOR: Hex;
    ORACLE_ROUTER: Hex;
    VOTING: Hex;
  };
  rpcUrl: string;
  registry: {
    chainId: number;
    rpcUrl: string;
    address: Hex;
  };
};

export type GovernanceProposalVM = {
  proposalId: number;
  proposalType: ProposalType;
  cityId: Hex;
  charityId: number;
  name: string;
  wallet: Hex;
  code: Hex;
  token: Hex;
  decimals: number;
  metadataRecordId: string;
  yesVotes: number;
  noVotes: number;
  deadline: number;
  status: ProposalStatus;
  proposer: Hex;
};

export type ReserveCurrencyVM = {
  code: Hex;
  token: Hex;
  decimals: number;
  enabled: boolean;
};

export type CharityMetadataRecord = {
  id: string;
  citySlug: string;
  proposalType: "charity" | "reserve";
  title: string;
  description: string;
  imageUrl: string | null;
  payload: Record<string, unknown>;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagementRoleResolution = {
  roles: ManagementRole[];
  flags: Record<ManagementRole, boolean>;
  context: CityContext;
};
