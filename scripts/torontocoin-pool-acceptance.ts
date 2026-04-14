import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { getTorontoCoinTrackedPoolStatuses } from "../shared/lib/contracts/torontocoinPools.ts";
import { getTorontoCoinRpcUrl, TORONTOCOIN_RUNTIME } from "../shared/lib/contracts/torontocoinRuntime.ts";
import { loadRepoEnv } from "./load-repo-env.ts";

loadRepoEnv();

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const liquidityRouterAbi = [
  {
    type: "function",
    name: "buyCplTcoin",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targetPoolId", type: "bytes32" },
      { name: "inputToken", type: "address" },
      { name: "inputAmount", type: "uint256" },
      { name: "minReserveOut", type: "uint256" },
      { name: "minCplTcoinOut", type: "uint256" },
    ],
    outputs: [
      { name: "selectedPoolId", type: "bytes32" },
      { name: "reserveAssetId", type: "bytes32" },
      { name: "reserveAmountUsed", type: "uint256" },
      { name: "mrTcoinUsed", type: "uint256" },
      { name: "cplTcoinOut", type: "uint256" },
      { name: "charityTopupOut", type: "uint256" },
      { name: "resolvedCharityId", type: "uint256" },
    ],
  },
] as const;

function parsePoolFilter(): Set<string> | null {
  const raw = process.env.TORONTOCOIN_ACCEPTANCE_POOL_IDS?.trim();
  if (!raw) {
    return null;
  }

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== "")
  );
}

async function main() {
  const client = createPublicClient({
    transport: http(getTorontoCoinRpcUrl()),
  });
  const pools = await getTorontoCoinTrackedPoolStatuses({
    client,
    runtime: TORONTOCOIN_RUNTIME,
  });
  const poolFilter = parsePoolFilter();
  const eligiblePools = pools.filter((pool) => {
    if (!pool.previewEnabled || !pool.registration.active) {
      return false;
    }
    return poolFilter ? poolFilter.has(pool.poolId.toLowerCase()) : pool.acceptanceEnabled;
  });

  const previews = eligiblePools.map((pool) => ({
    poolId: pool.poolId,
    name: pool.name,
    cplTcoinOut: pool.scenarioPreview?.cplTcoinOutFormatted ?? null,
    reserveOut: pool.scenarioPreview?.reserveAmountOutFormatted ?? null,
    healthy: pool.scenarioPreview?.healthy ?? false,
  }));

  const liveBuyEnabled = process.env.TORONTOCOIN_LIVE_BUY_ENABLED === "true";
  if (!liveBuyEnabled) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          liveBuyEnabled: false,
          previews,
        },
        null,
        2
      )
    );
    return;
  }

  const privateKey = process.env.DEPLOYER_KEY?.trim();
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("DEPLOYER_KEY is required for a live acceptance buy.");
  }

  if (eligiblePools.length === 0) {
    throw new Error("No eligible pools matched TORONTOCOIN_ACCEPTANCE_POOL_IDS or acceptanceEnabled.");
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    transport: http(getTorontoCoinRpcUrl()),
  });

  const pool = eligiblePools[0];
  const minReserveOut = BigInt(0);
  const previewCplOut = pool.scenarioPreview?.cplTcoinOut ? BigInt(pool.scenarioPreview.cplTcoinOut) : BigInt(0);
  const minCplTcoinOut = previewCplOut > BigInt(0) ? (previewCplOut * BigInt(95)) / BigInt(100) : BigInt(0);

  const approveHash = await walletClient.writeContract({
    address: TORONTOCOIN_RUNTIME.scenarioInputToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [TORONTOCOIN_RUNTIME.liquidityRouter, TORONTOCOIN_RUNTIME.scenarioInputAmount],
    chain: null,
    account,
  });
  await client.waitForTransactionReceipt({ hash: approveHash });

  const buyHash = await walletClient.writeContract({
    address: TORONTOCOIN_RUNTIME.liquidityRouter,
    abi: liquidityRouterAbi,
    functionName: "buyCplTcoin",
    args: [
      pool.poolId,
      TORONTOCOIN_RUNTIME.scenarioInputToken,
      TORONTOCOIN_RUNTIME.scenarioInputAmount,
      minReserveOut,
      minCplTcoinOut,
    ],
    chain: null,
    account,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: buyHash });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        liveBuyEnabled: true,
        poolId: pool.poolId,
        poolName: pool.name,
        approveHash,
        buyHash,
        receipt: {
          transactionHash: receipt.transactionHash,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        },
        previews,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
