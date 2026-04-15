import { normaliseCredentialId } from "@shared/api/services/supabaseService";
import { getActiveCityContracts, getRpcUrlForChainId } from "@shared/lib/contracts/cityContracts";
import {
  getTorontoCoinRuntimeConfig,
  TORONTOCOIN_RUNTIME,
} from "@shared/lib/contracts/torontocoinRuntime";

export class WebAuthnRequestInProgressError extends Error {
  constructor() {
    super(
      "A WebAuthn verification is already in progress. Complete or cancel the pending approval before trying again."
    );
    this.name = "WebAuthnRequestInProgressError";
  }
}

export type UserShareRow = {
  id: number;
  credential_id: string | null;
  user_share_encrypted: any;
};

export function resolveShareSelection({
  userShares,
  activeCredentialId,
  activeAppSlug,
}: {
  userShares: UserShareRow[] | null | undefined;
  activeCredentialId: string | null;
  activeAppSlug?: string | null;
}) {
  if (!userShares || userShares.length === 0) {
    const scope = activeAppSlug ? ` for app instance "${activeAppSlug}"` : "";
    throw new Error(
      `No user shares were found${scope}. Reconnect your wallet to refresh passkey credentials.`
    );
  }

  const matchingCredential = activeCredentialId
    ? userShares.find(
        (row) => normaliseCredentialId(row.credential_id) === activeCredentialId
      )
    : null;
  const selectedShare = matchingCredential ?? userShares[0];
  const credentialCandidates = userShares
    .map((row) => normaliseCredentialId(row.credential_id))
    .filter((value): value is string => Boolean(value));

  return {
    selectedShare,
    credentialCandidates,
    usedCredentialFallback: Boolean(activeCredentialId && !matchingCredential),
  };
}

export async function resolveTokenRuntimeConfig() {
  const torontoCoinRuntime = getTorontoCoinRuntimeConfig({
    citySlug: process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin",
    chainId: TORONTOCOIN_RUNTIME.chainId,
  });

  if (torontoCoinRuntime) {
    return {
      tokenAddress: torontoCoinRuntime.cplTcoin.address,
      rpcUrl: torontoCoinRuntime.rpcUrl,
      chainId: torontoCoinRuntime.chainId,
      decimals: torontoCoinRuntime.cplTcoin.decimals,
    };
  }

  try {
    const activeContracts = await getActiveCityContracts();
    return {
      tokenAddress: activeContracts.contracts.TCOIN,
      rpcUrl: getRpcUrlForChainId(activeContracts.chainId),
      chainId: activeContracts.chainId,
      decimals: 18,
    };
  } catch (error) {
    console.warn("Falling back to default TorontoCoin runtime config.", error);
    return {
      tokenAddress: TORONTOCOIN_RUNTIME.cplTcoin.address,
      rpcUrl: getRpcUrlForChainId(42220),
      chainId: 42220,
      decimals: TORONTOCOIN_RUNTIME.cplTcoin.decimals,
    };
  }
}
