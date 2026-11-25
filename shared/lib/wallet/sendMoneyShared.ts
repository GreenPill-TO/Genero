import { normaliseCredentialId } from "@shared/api/services/supabaseService";
import {
  getTorontoCoinWalletRuntimeOrThrow,
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
  const runtime = getTorontoCoinWalletRuntimeOrThrow();
  return {
    target: runtime.target,
    purpose: runtime.purpose,
    tokenAddress: runtime.cplTcoin.address,
    rpcUrl: runtime.rpcUrl,
    chainId: runtime.chainId,
    decimals: runtime.cplTcoin.decimals,
    explorerBaseUrl: runtime.explorerBaseUrl,
    transferGasLimit: runtime.transferGasLimit,
    maxFeePerGasWei: runtime.maxFeePerGasWei,
  };
}
