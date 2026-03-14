import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveActiveUserBia, resolveActiveBiaPoolMapping } from "@shared/lib/sarafu/routing";
import { getActiveCityContracts } from "@shared/lib/contracts/cityContracts";
import { resolveOnrampConfig } from "./config";
import { deriveWalletAtIndex } from "./depositWallets";
import type { OnrampAttemptMode, OnrampCheckoutSessionRow, OnrampSessionStatus } from "./types";

const erc20ReadWriteAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const tcoinMintRouterAbi = [
  {
    type: "function",
    name: "previewMintTcoinWithToken",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "requestedCharityId", type: "uint256" },
      { name: "swapData", type: "bytes" },
    ],
    outputs: [
      { name: "cadmOut", type: "uint256" },
      { name: "tcoinOut", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "mintTcoinWithUSDC",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usdcAmountIn", type: "uint256" },
      { name: "minCadmOut", type: "uint256" },
      { name: "minTcoinOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "requestedCharityId", type: "uint256" },
      { name: "swapData", type: "bytes" },
    ],
    outputs: [{ name: "tcoinOut", type: "uint256" }],
  },
] as const;

type SettlementResult = {
  sessionId: string;
  status: OnrampSessionStatus;
  skipped: boolean;
  reason?: string;
  mintTxHash?: string;
};

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function clampMin(value: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(9_999, slippageBps)));
  return (value * (BigInt(10_000) - bps)) / BigInt(10_000);
}

function isTerminal(status: OnrampSessionStatus): boolean {
  return status === "mint_complete" || status === "failed";
}

async function resolveSession(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
}): Promise<OnrampCheckoutSessionRow> {
  const { data, error } = await options.supabase
    .from("onramp_checkout_sessions")
    .select("*")
    .eq("id", options.sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load onramp session: ${error.message}`);
  }

  if (!data) {
    throw new Error("Onramp session not found.");
  }

  return data as OnrampCheckoutSessionRow;
}

async function updateSession(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  patch: Record<string, unknown>;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase
    .from("onramp_checkout_sessions")
    .update({
      ...options.patch,
      updated_at: nowIso,
    })
    .eq("id", options.sessionId);

  if (error) {
    throw new Error(`Failed to update onramp session: ${error.message}`);
  }
}

async function nextAttemptNo(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
}): Promise<number> {
  const { data, error } = await options.supabase
    .from("onramp_settlement_attempts")
    .select("attempt_no")
    .eq("session_id", options.sessionId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read settlement attempts: ${error.message}`);
  }

  return Number(data?.attempt_no ?? 0) + 1;
}

async function insertAttempt(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  attemptNo: number;
  mode: OnrampAttemptMode;
  state: "started" | "succeeded" | "failed";
  errorMessage?: string | null;
  mintTxHash?: string | null;
  routerAddress?: string;
  routerCallPayload?: Record<string, unknown>;
  minCadmOut?: string;
  minTcoinOut?: string;
  deadlineUnix?: number;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase.from("onramp_settlement_attempts").insert({
    session_id: options.sessionId,
    attempt_no: options.attemptNo,
    mode: options.mode,
    state: options.state,
    error_message: options.errorMessage ?? null,
    mint_tx_hash: options.mintTxHash ?? null,
    router_address: options.routerAddress ?? null,
    router_call_payload: options.routerCallPayload ?? {},
    min_cadm_out: options.minCadmOut ?? null,
    min_tcoin_out: options.minTcoinOut ?? null,
    deadline_unix: options.deadlineUnix ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) {
    throw new Error(`Failed to persist settlement attempt: ${error.message}`);
  }
}

async function updateAttempt(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  attemptNo: number;
  patch: Record<string, unknown>;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await options.supabase
    .from("onramp_settlement_attempts")
    .update({
      ...options.patch,
      updated_at: nowIso,
    })
    .eq("session_id", options.sessionId)
    .eq("attempt_no", options.attemptNo);

  if (error) {
    throw new Error(`Failed to update settlement attempt: ${error.message}`);
  }
}

async function tryAcquireLock(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  owner: string;
}): Promise<boolean> {
  const { data, error } = await options.supabase.rpc("onramp_try_acquire_lock", {
    p_session_id: options.sessionId,
    p_lock_owner: options.owner,
    p_ttl_seconds: 120,
  });

  if (error) {
    throw new Error(`Failed to acquire onramp lock: ${error.message}`);
  }

  return Boolean(data);
}

async function releaseLock(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  owner: string;
}) {
  await options.supabase.rpc("onramp_release_lock", {
    p_session_id: options.sessionId,
    p_lock_owner: options.owner,
  });
}

async function resolveRequestedCharityId(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
}): Promise<number> {
  const { data, error } = await options.supabase
    .from("app_user_profiles")
    .select("charity_preferences")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.charity_preferences !== "object" || !data.charity_preferences) {
    return 0;
  }

  const prefs = data.charity_preferences as Record<string, unknown>;
  const candidate = prefs.charityId ?? prefs.charity_id ?? prefs.selectedCauseId ?? prefs.selected_cause_id;
  const parsed = asNumber(candidate);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

async function ensureDepositWalletGas(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  gasBankWalletClient: ReturnType<typeof createWalletClient>;
  depositAddress: Address;
}) {
  const config = resolveOnrampConfig();
  const currentBalance = await options.publicClient.getBalance({ address: options.depositAddress });
  if (currentBalance >= config.gasTopupMinWei) {
    return;
  }

  const transferAmount = config.gasTopupTargetWei > currentBalance
    ? config.gasTopupTargetWei - currentBalance
    : config.gasTopupMinWei;

  const hash = await options.gasBankWalletClient.sendTransaction({
    to: options.depositAddress,
    value: transferAmount,
  } as any);

  await options.publicClient.waitForTransactionReceipt({ hash });
}

async function insertPoolPurchaseAttribution(options: {
  supabase: SupabaseClient<any, any, any>;
  session: OnrampCheckoutSessionRow;
  chainId: number;
  tcoinAddress: Address;
  mintTxHash: string;
  tokenOutAmount: string;
}) {
  try {
    const activeBia = await resolveActiveUserBia({
      supabase: options.supabase,
      userId: Number(options.session.user_id),
      appInstanceId: Number(options.session.app_instance_id),
    });

    if (!activeBia) {
      return;
    }

    const mapping = await resolveActiveBiaPoolMapping({
      supabase: options.supabase,
      biaId: activeBia,
      chainId: options.chainId,
    });

    if (!mapping) {
      return;
    }

    const nowIso = new Date().toISOString();
    await options.supabase.from("pool_purchase_requests").insert({
      user_id: options.session.user_id,
      app_instance_id: options.session.app_instance_id,
      bia_id: activeBia,
      chain_id: options.chainId,
      pool_address: mapping.poolAddress,
      token_address: options.tcoinAddress,
      fiat_amount: options.session.fiat_amount,
      token_amount: options.tokenOutAmount,
      tx_hash: options.mintTxHash,
      status: "confirmed",
      metadata: {
        execution_mode: "onramp_checkout",
        session_id: options.session.id,
        provider: options.session.provider,
      },
      created_at: nowIso,
      updated_at: nowIso,
    });
  } catch {
    // Attribution should not block settlement completion.
  }
}

function validateSessionAddresses(session: OnrampCheckoutSessionRow): {
  depositAddress: Address;
  recipientWallet: Address;
} {
  if (!isAddress(session.deposit_address)) {
    throw new Error("Invalid deposit wallet address stored on session.");
  }

  if (!isAddress(session.recipient_wallet)) {
    throw new Error("Invalid recipient wallet address stored on session.");
  }

  return {
    depositAddress: getAddress(session.deposit_address),
    recipientWallet: getAddress(session.recipient_wallet),
  };
}

async function countAttemptsByMode(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  mode: OnrampAttemptMode;
}): Promise<number> {
  const { count, error } = await options.supabase
    .from("onramp_settlement_attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", options.sessionId)
    .eq("mode", options.mode);

  if (error) {
    throw new Error(`Failed to count settlement attempts: ${error.message}`);
  }

  return Number(count ?? 0);
}

export async function runSessionSettlement(options: {
  supabase: SupabaseClient<any, any, any>;
  sessionId: string;
  mode?: OnrampAttemptMode;
  trigger?: "webhook" | "touch" | "admin";
  actorUserId?: number | null;
}): Promise<SettlementResult> {
  const mode = options.mode ?? "auto";
  const config = resolveOnrampConfig();
  const lockOwner = `onramp:${mode}:${randomUUID()}`;
  let activeAttemptNo: number | null = null;

  const lockAcquired = await tryAcquireLock({
    supabase: options.supabase,
    sessionId: options.sessionId,
    owner: lockOwner,
  });

  if (!lockAcquired) {
    return {
      sessionId: options.sessionId,
      status: "mint_started",
      skipped: true,
      reason: "session_locked",
    };
  }

  try {
    const session = await resolveSession({
      supabase: options.supabase,
      sessionId: options.sessionId,
    });

    if (isTerminal(session.status)) {
      return {
        sessionId: session.id,
        status: session.status,
        skipped: true,
        reason: "terminal_status",
      };
    }

    if (mode === "auto") {
      const autoAttempts = await countAttemptsByMode({
        supabase: options.supabase,
        sessionId: session.id,
        mode: "auto",
      });

      if (autoAttempts >= config.maxAutoAttempts) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "manual_review",
            status_reason: "Reached max auto settlement attempts.",
          },
        });

        return {
          sessionId: session.id,
          status: "manual_review",
          skipped: true,
          reason: "max_auto_attempts",
        };
      }
    }

    if (mode === "manual_operator") {
      const manualAttempts = await countAttemptsByMode({
        supabase: options.supabase,
        sessionId: session.id,
        mode: "manual_operator",
      });

      if (manualAttempts >= config.maxManualAttempts) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "failed",
            status_reason: "Reached max manual settlement attempts.",
          },
        });

        return {
          sessionId: session.id,
          status: "failed",
          skipped: true,
          reason: "max_manual_attempts",
        };
      }
    }

    const createdAt = new Date(session.created_at).getTime();
    const ageSeconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.trunc((Date.now() - createdAt) / 1000))
      : 0;

    const { depositAddress, recipientWallet } = validateSessionAddresses(session);

    const publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });

    const usdcDecimals = await publicClient.readContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "decimals",
    });

    const usdcBalance = await publicClient.readContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [depositAddress],
    });

    if (usdcBalance <= BigInt(0)) {
      if (ageSeconds >= config.settlementTimeoutSeconds) {
        await updateSession({
          supabase: options.supabase,
          sessionId: session.id,
          patch: {
            status: "manual_review",
            status_reason: "USDC settlement not detected before timeout.",
          },
        });

        return {
          sessionId: session.id,
          status: "manual_review",
          skipped: true,
          reason: "usdc_timeout",
        };
      }

      return {
        sessionId: session.id,
        status: session.status,
        skipped: true,
        reason: "usdc_not_received",
      };
    }

    const usdcAmountString = formatUnits(usdcBalance, usdcDecimals);

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "usdc_received",
        usdc_received_amount: usdcAmountString,
      },
    });

    const requestedCharityId =
      typeof session.requested_charity_id === "number" && session.requested_charity_id > 0
        ? session.requested_charity_id
        : await resolveRequestedCharityId({
            supabase: options.supabase,
            userId: Number(session.user_id),
            appInstanceId: Number(session.app_instance_id),
          });

    const swapData = config.defaultSwapData;

    const [quoteCadmOut, quoteTcoinOut] = await publicClient.readContract({
      address: config.routerAddress,
      abi: tcoinMintRouterAbi,
      functionName: "previewMintTcoinWithToken",
      args: [config.usdcTokenAddress, usdcBalance, BigInt(requestedCharityId), swapData],
    });

    if (quoteCadmOut <= BigInt(0) || quoteTcoinOut <= BigInt(0)) {
      await updateSession({
        supabase: options.supabase,
        sessionId: session.id,
        patch: {
          status: "manual_review",
          status_reason: "Router preview quote returned zero output.",
        },
      });

      return {
        sessionId: session.id,
        status: "manual_review",
        skipped: true,
        reason: "zero_quote",
      };
    }

    const minCadmOut = clampMin(quoteCadmOut, config.slippageBps);
    const minTcoinOut = clampMin(quoteTcoinOut, config.slippageBps);
    const deadlineUnix = Math.trunc(Date.now() / 1000) + config.deadlineSeconds;

    const attemptNo = await nextAttemptNo({
      supabase: options.supabase,
      sessionId: session.id,
    });
    activeAttemptNo = attemptNo;

    await insertAttempt({
      supabase: options.supabase,
      sessionId: session.id,
      attemptNo,
      mode,
      state: "started",
      routerAddress: config.routerAddress,
      routerCallPayload: {
        functionName: "mintTcoinWithUSDC",
        usdcAmountIn: usdcBalance.toString(),
        requestedCharityId,
        swapAdapterId: config.swapAdapterId,
      },
      minCadmOut: minCadmOut.toString(),
      minTcoinOut: minTcoinOut.toString(),
      deadlineUnix,
    });

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "mint_started",
        status_reason: null,
        requested_charity_id: requestedCharityId > 0 ? requestedCharityId : null,
        quote_payload: {
          quoteCadmOut: quoteCadmOut.toString(),
          quoteTcoinOut: quoteTcoinOut.toString(),
          minCadmOut: minCadmOut.toString(),
          minTcoinOut: minTcoinOut.toString(),
          slippageBps: config.slippageBps,
          deadlineUnix,
        },
      },
    });

    const depositWalletRow = await options.supabase
      .from("onramp_deposit_wallets")
      .select("derivation_index")
      .eq("user_id", session.user_id)
      .eq("app_instance_id", session.app_instance_id)
      .eq("chain_id", config.targetChainId)
      .limit(1)
      .maybeSingle();

    if (depositWalletRow.error || !depositWalletRow.data) {
      throw new Error("Unable to resolve deposit wallet derivation index.");
    }

    const derivedWallet = deriveWalletAtIndex(Number(depositWalletRow.data.derivation_index));
    if (derivedWallet.address.toLowerCase() !== depositAddress.toLowerCase()) {
      throw new Error("Deposit wallet derivation mismatch.");
    }

    const depositAccount = privateKeyToAccount(derivedWallet.privateKey);
    const gasBankAccount = privateKeyToAccount(config.gasBankPrivateKey);

    const walletClient = createWalletClient({
      account: depositAccount,
      transport: http(config.rpcUrl),
    });

    const gasBankWalletClient = createWalletClient({
      account: gasBankAccount,
      transport: http(config.rpcUrl),
    });

    await ensureDepositWalletGas({
      publicClient,
      gasBankWalletClient,
      depositAddress,
    });

    const approvalHash = await walletClient.writeContract({
      address: config.usdcTokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: "approve",
      args: [config.routerAddress, usdcBalance],
    } as any);

    await publicClient.waitForTransactionReceipt({ hash: approvalHash });

    const activeContracts = await getActiveCityContracts({
      citySlug: session.city_slug,
      forceRefresh: true,
    });
    const tcoinAddress = getAddress(activeContracts.contracts.TCOIN);

    const tcoinDecimals = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "decimals",
    });

    const recipientBalanceBefore = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [recipientWallet],
    });

    const mintHash = await walletClient.writeContract({
      address: config.routerAddress,
      abi: tcoinMintRouterAbi,
      functionName: "mintTcoinWithUSDC",
      args: [
        usdcBalance,
        minCadmOut,
        minTcoinOut,
        BigInt(deadlineUnix),
        recipientWallet,
        BigInt(requestedCharityId),
        swapData,
      ],
    } as any);

    await publicClient.waitForTransactionReceipt({ hash: mintHash });

    const recipientBalanceAfter = await publicClient.readContract({
      address: tcoinAddress,
      abi: erc20ReadWriteAbi,
      functionName: "balanceOf",
      args: [recipientWallet],
    });

    const tcoinDelta = recipientBalanceAfter > recipientBalanceBefore
      ? recipientBalanceAfter - recipientBalanceBefore
      : BigInt(0);
    const tcoinOutAmount = formatUnits(tcoinDelta, tcoinDecimals);

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: "mint_complete",
        status_reason: null,
        incoming_usdc_tx_hash: session.incoming_usdc_tx_hash ?? null,
        mint_tx_hash: mintHash,
        tcoin_delivery_tx_hash: mintHash,
        tcoin_out_amount: tcoinOutAmount,
        metadata: {
          ...(session.metadata ?? {}),
          settlement_trigger: options.trigger ?? "touch",
          settlement_mode: mode,
          approval_tx_hash: approvalHash,
          completed_at: new Date().toISOString(),
        },
      },
    });

    await updateAttempt({
      supabase: options.supabase,
      sessionId: session.id,
      attemptNo,
      patch: {
        state: "succeeded",
        mint_tx_hash: mintHash,
        error_message: null,
        router_address: config.routerAddress,
        router_call_payload: {
          functionName: "mintTcoinWithUSDC",
          approvalTxHash: approvalHash,
        },
        min_cadm_out: minCadmOut.toString(),
        min_tcoin_out: minTcoinOut.toString(),
        deadline_unix: deadlineUnix,
      },
    });

    await insertPoolPurchaseAttribution({
      supabase: options.supabase,
      session,
      chainId: config.targetChainId,
      tcoinAddress,
      mintTxHash: mintHash,
      tokenOutAmount: tcoinOutAmount,
    });

    await options.supabase.from("governance_actions_log").insert({
      action_type: "onramp_mint_completed",
      city_slug: session.city_slug,
      actor_user_id: options.actorUserId ?? null,
      reason: "Onramp auto-mint completed",
      payload: {
        sessionId: session.id,
        mintTxHash: mintHash,
        usdcReceivedAmount: usdcAmountString,
        tcoinOutAmount,
      },
    });

    return {
      sessionId: session.id,
      status: "mint_complete",
      skipped: false,
      mintTxHash: mintHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown onramp settlement error";

    const session = await resolveSession({
      supabase: options.supabase,
      sessionId: options.sessionId,
    });

    if (activeAttemptNo != null) {
      await updateAttempt({
        supabase: options.supabase,
        sessionId: session.id,
        attemptNo: activeAttemptNo,
        patch: {
          state: "failed",
          error_message: message,
        },
      });
    } else {
      const attemptNo = await nextAttemptNo({
        supabase: options.supabase,
        sessionId: session.id,
      });

      await insertAttempt({
        supabase: options.supabase,
        sessionId: session.id,
        attemptNo,
        mode,
        state: "failed",
        errorMessage: message,
      });
    }

    const createdAt = new Date(session.created_at).getTime();
    const ageSeconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.trunc((Date.now() - createdAt) / 1000))
      : 0;

    const nextStatus: OnrampSessionStatus = ageSeconds >= resolveOnrampConfig().settlementTimeoutSeconds
      ? "manual_review"
      : "mint_started";

    await updateSession({
      supabase: options.supabase,
      sessionId: session.id,
      patch: {
        status: nextStatus,
        status_reason: message,
      },
    });

    await options.supabase.from("governance_actions_log").insert({
      action_type: "onramp_settlement_failed",
      city_slug: session.city_slug,
      actor_user_id: options.actorUserId ?? null,
      reason: "Onramp settlement attempt failed",
      payload: {
        sessionId: session.id,
        mode,
        error: message,
      },
    });

    return {
      sessionId: session.id,
      status: nextStatus,
      skipped: false,
      reason: message,
    };
  } finally {
    await releaseLock({
      supabase: options.supabase,
      sessionId: options.sessionId,
      owner: lockOwner,
    });
  }
}

export async function runUserOnrampTouch(options: {
  supabase: SupabaseClient<any, any, any>;
  userId: number;
  appInstanceId: number;
  citySlug: string;
}): Promise<{ scanned: number; settled: number; manualReview: number; skipped: number }> {
  const { data, error } = await options.supabase
    .from("onramp_checkout_sessions")
    .select("id,status")
    .eq("user_id", options.userId)
    .eq("app_instance_id", options.appInstanceId)
    .eq("city_slug", options.citySlug)
    .in("status", ["created", "widget_opened", "payment_submitted", "crypto_sent", "usdc_received", "mint_started", "manual_review"]) 
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Failed to load onramp touch sessions: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  let settled = 0;
  let manualReview = 0;
  let skipped = 0;

  for (const row of rows) {
    const mode: OnrampAttemptMode = row.status === "manual_review" ? "manual_operator" : "auto";
    const result = await runSessionSettlement({
      supabase: options.supabase,
      sessionId: String(row.id),
      mode,
      trigger: "touch",
      actorUserId: options.userId,
    });

    if (result.skipped) {
      skipped += 1;
      continue;
    }

    if (result.status === "mint_complete") {
      settled += 1;
    } else if (result.status === "manual_review") {
      manualReview += 1;
    }
  }

  return {
    scanned: rows.length,
    settled,
    manualReview,
    skipped,
  };
}
