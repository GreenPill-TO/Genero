import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { encodeFunctionData, getAddress, isAddress, type Address } from "viem";

const EXPECTED_CHAIN_ID = 11142220;
const EXPECTED_MINT = "500000000";
const EXPECTED_PAYMENT = "100000000";
const execFileAsync = promisify(execFile);
const REQUIRED_ROLES = [
  "deployer",
  "vaultOwner",
  "tokenAdmin",
  "operationalIndexer",
  "temporaryWriter",
  "payer",
  "recipient",
] as const;
const MINT_ABI = [
  { type: "function", name: "setMaxSupply", stateMutability: "nonpayable", inputs: [{ name: "cap", type: "uint256" }], outputs: [] },
  { type: "function", name: "addWriter", stateMutability: "nonpayable", inputs: [{ name: "writer", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mintTo", stateMutability: "nonpayable", inputs: [{ name: "beneficiary", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "deleteWriter", stateMutability: "nonpayable", inputs: [{ name: "writer", type: "address" }], outputs: [{ type: "bool" }] },
] as const;
const TRANSFER_ABI = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;
const REQUIRED_CONTRACTS = [
  "governance",
  "treasury",
  "poolRegistry",
  "liquidityRouter",
  "sarafuSwapPoolAdapter",
  "bootstrapSwapPool",
  "mrTcoin",
  "cplTcoin",
] as const;

type Plan = Record<string, unknown>;

function objectAt(plan: Plan, key: string): Record<string, unknown> {
  const value = plan[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactInteger(value: unknown, key: string, expected?: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${key} must be a base-10 integer string.`);
  }
  if (expected !== undefined && value !== expected) {
    throw new Error(`${key} must equal ${expected}.`);
  }
  return BigInt(value);
}

function requiredAddress(record: Record<string, unknown>, key: string): Address {
  const value = record[key];
  if (typeof value !== "string" || !isAddress(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${key} must be a reviewed non-zero address.`);
  }
  return getAddress(value);
}

export function validateTorontoCoinPayLinkPlan(plan: Plan, expected: {
  sourceCommit: string;
  deployConfigSha256: string;
}) {
  if (plan.version !== 1) throw new Error("version must be 1.");
  if (plan.stage !== "post-deployment-mint-and-payment") {
    throw new Error("stage must be post-deployment-mint-and-payment.");
  }
  if (plan.deploymentApproved !== true || typeof plan.deploymentPlanSha256 !== "string" || !/^[0-9a-f]{64}$/.test(plan.deploymentPlanSha256)) {
    throw new Error("A separately reviewed deployment approval and plan hash are required.");
  }
  if (plan.target !== "celo-sepolia-pay-link" || plan.purpose !== "pay-link-only") {
    throw new Error("target and purpose must select the dedicated pay-link profile.");
  }
  if (plan.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`chainId must equal ${EXPECTED_CHAIN_ID}.`);
  }
  if (plan.sourceCommit !== expected.sourceCommit) {
    throw new Error("sourceCommit does not match the reviewed source.");
  }
  if (plan.deployConfigSha256 !== expected.deployConfigSha256) {
    throw new Error("deployConfigSha256 does not match the reviewed deployment config.");
  }
  if (typeof plan.rpcUrl !== "string" || !plan.rpcUrl.startsWith("https://")) {
    throw new Error("rpcUrl must be an explicit HTTPS endpoint.");
  }

  const roles = objectAt(plan, "roles");
  const resolvedRoles = Object.fromEntries(
    REQUIRED_ROLES.map((role) => [role, requiredAddress(roles, role)])
  ) as Record<(typeof REQUIRED_ROLES)[number], Address>;
  if (resolvedRoles.payer === resolvedRoles.recipient) {
    throw new Error("payer and recipient must be distinct reviewed accounts.");
  }
  if (
    resolvedRoles.temporaryWriter === resolvedRoles.payer ||
    resolvedRoles.temporaryWriter === resolvedRoles.recipient
  ) {
    throw new Error("temporaryWriter, payer and recipient must be three distinct reviewed accounts.");
  }

  const contracts = objectAt(plan, "contracts");
  const resolvedContracts = Object.fromEntries(
    REQUIRED_CONTRACTS.map((contract) => [contract, requiredAddress(contracts, contract)])
  ) as Record<(typeof REQUIRED_CONTRACTS)[number], Address>;
  if (resolvedContracts.cplTcoin === resolvedContracts.mrTcoin) {
    throw new Error("cplTcoin and mrTcoin must be distinct deployments.");
  }

  const allocations = objectAt(plan, "allocations");
  exactInteger(allocations.cplTcoinPayerMint, "allocations.cplTcoinPayerMint", EXPECTED_MINT);
  exactInteger(allocations.paymentAmount, "allocations.paymentAmount", EXPECTED_PAYMENT);
  for (const key of ["poolSeed", "mrTcoinMint", "reserveMint"] as const) {
    exactInteger(allocations[key], `allocations.${key}`, "0");
  }

  const expectedOperations = [
    { step: "set-cap", from: resolvedRoles.tokenAdmin, to: resolvedContracts.cplTcoin, calldata: encodeFunctionData({ abi: MINT_ABI, functionName: "setMaxSupply", args: [BigInt(EXPECTED_MINT)] }) },
    { step: "add-writer", from: resolvedRoles.tokenAdmin, to: resolvedContracts.cplTcoin, calldata: encodeFunctionData({ abi: MINT_ABI, functionName: "addWriter", args: [resolvedRoles.temporaryWriter] }) },
    { step: "mint-once", from: resolvedRoles.temporaryWriter, to: resolvedContracts.cplTcoin, calldata: encodeFunctionData({ abi: MINT_ABI, functionName: "mintTo", args: [resolvedRoles.payer, BigInt(EXPECTED_MINT)] }) },
    { step: "revoke-writer", from: resolvedRoles.tokenAdmin, to: resolvedContracts.cplTcoin, calldata: encodeFunctionData({ abi: MINT_ABI, functionName: "deleteWriter", args: [resolvedRoles.temporaryWriter] }) },
    { step: "pay-100", from: resolvedRoles.payer, to: resolvedContracts.cplTcoin, calldata: encodeFunctionData({ abi: TRANSFER_ABI, functionName: "transfer", args: [resolvedRoles.recipient, BigInt(EXPECTED_PAYMENT)] }) },
  ];
  const gasBudget = objectAt(plan, "gasBudget");
  const transactions = gasBudget.transactions;
  if (!Array.isArray(transactions) || transactions.length !== expectedOperations.length) {
    throw new Error("gasBudget.transactions must bind the four mint calls and one 100-token payment.");
  }
  let computedMaximum = BigInt(0);
  const seenNonces = new Set<string>();
  expectedOperations.forEach((expectedOperation, index) => {
    const operation = transactions[index] as Record<string, unknown> | undefined;
    for (const key of ["step", "from", "to", "calldata"] as const) {
      if (String(operation?.[key]).toLowerCase() !== expectedOperation[key].toLowerCase()) {
        throw new Error(`gasBudget.transactions[${index}].${key} does not match the bound reviewed call.`);
      }
    }
    const nonce = exactInteger(operation?.nonce, `gasBudget.transactions[${index}].nonce`);
    const nonceKey = `${expectedOperation.from.toLowerCase()}:${nonce}`;
    if (seenNonces.has(nonceKey)) throw new Error("Transaction nonces must be unique per sender.");
    seenNonces.add(nonceKey);
    const gasLimit = exactInteger(operation?.gasLimit, `gasBudget.transactions[${index}].gasLimit`);
    const maxFeePerGasWei = exactInteger(operation?.maxFeePerGasWei, `gasBudget.transactions[${index}].maxFeePerGasWei`);
    if (gasLimit === 0n || maxFeePerGasWei === 0n) throw new Error("Transaction gas and fee ceilings must be positive.");
    computedMaximum += gasLimit * maxFeePerGasWei;
  });
  const totalMaximum = exactInteger(gasBudget.totalMaxCostWei, "gasBudget.totalMaxCostWei");
  if (totalMaximum < computedMaximum) throw new Error("gasBudget.totalMaxCostWei is below the per-transaction maximum total.");
  const requiredReadbacks = ["rpcChainId", "cplTcoinCode", "decimals", "owner", "temporaryWriterStatus", "maxSupply", "totalSupply", "payerBalance", "mintReceipt", "writerRevoked"];
  if (!Array.isArray(plan.requiredReadbacks) || JSON.stringify(plan.requiredReadbacks) !== JSON.stringify(requiredReadbacks)) {
    throw new Error("requiredReadbacks must retain every chain, token, supply, receipt and revocation check.");
  }
  if (typeof plan.interruptedSequenceRecovery !== "string" || !plan.interruptedSequenceRecovery.trim()) {
    throw new Error("interruptedSequenceRecovery must describe readback before any retry.");
  }

  return {
    ...plan,
    roles: resolvedRoles,
    contracts: resolvedContracts,
    validationLevel: "static-post-deployment-mint-and-payment-approval-schema-only",
    deploymentExecutionAuthorised: false,
    mintPaymentExecutionAuthorised: false,
    computedMaximumGasCostWei: computedMaximum.toString(),
  };
}

export async function validateTorontoCoinPayLinkPlanFile(planPath: string) {
  const root = process.cwd();
  const [{ stdout: sourceCommitOutput }, { stdout: worktreeStatus }, deployConfig] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root }),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root }),
    readFile(resolve(root, "contracts/foundry/deploy-config.json")),
  ]);
  const sourceCommit = sourceCommitOutput.trim();
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error("Could not resolve the actual reviewed source commit.");
  }
  if (worktreeStatus.trim()) {
    throw new Error("The worktree must be clean before validating a reviewed execution plan.");
  }
  const reviewedCommit = process.env.TCOIN_PAY_LINK_REVIEWED_COMMIT?.trim();
  if (!reviewedCommit || !/^[0-9a-f]{40}$/.test(reviewedCommit)) {
    throw new Error("TCOIN_PAY_LINK_REVIEWED_COMMIT must name the reviewed 40-character commit.");
  }
  const plan = JSON.parse(await readFile(resolve(root, planPath), "utf8")) as Plan;
  if (sourceCommit !== reviewedCommit) {
    throw new Error("The actual checkout does not match TCOIN_PAY_LINK_REVIEWED_COMMIT.");
  }
  return validateTorontoCoinPayLinkPlan(plan, {
    sourceCommit: reviewedCommit,
    deployConfigSha256: createHash("sha256").update(deployConfig).digest("hex"),
  });
}

if (process.argv[1]?.endsWith("torontocoin-pay-link-plan.ts")) {
  const planPath = process.argv[2];
  if (!planPath) {
    throw new Error("Usage: pnpm ops:torontocoin:pay-link:plan <reviewed-plan.json>");
  }
  validateTorontoCoinPayLinkPlanFile(planPath).then((plan) => {
    console.log(JSON.stringify({ staticApprovalSchemaValid: true, executionAuthorised: false, plan }, null, 2));
  });
}
