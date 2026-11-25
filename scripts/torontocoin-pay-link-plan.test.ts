import { describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import type { Address } from "viem";
import { validateTorontoCoinPayLinkPlan } from "./torontocoin-pay-link-plan";

const address = (suffix: string): Address => `0x${suffix.padStart(40, "0")}`;
const expected = { sourceCommit: "a".repeat(40), deployConfigSha256: "b".repeat(64) };

function validPlan() {
  const roles = {
    deployer: address("1"), vaultOwner: address("2"), tokenAdmin: address("3"),
    operationalIndexer: address("4"), temporaryWriter: address("7"), payer: address("5"), recipient: address("6"),
  };
  const contracts = {
    governance: address("11"), treasury: address("12"), poolRegistry: address("13"),
    liquidityRouter: address("14"), sarafuSwapPoolAdapter: address("15"),
    bootstrapSwapPool: address("16"), mrTcoin: address("17"), cplTcoin: address("18"),
  };
  const abi = [
    { type: "function", name: "setMaxSupply", stateMutability: "nonpayable", inputs: [{ name: "cap", type: "uint256" }], outputs: [] },
    { type: "function", name: "addWriter", stateMutability: "nonpayable", inputs: [{ name: "writer", type: "address" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "mintTo", stateMutability: "nonpayable", inputs: [{ name: "beneficiary", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "deleteWriter", stateMutability: "nonpayable", inputs: [{ name: "writer", type: "address" }], outputs: [{ type: "bool" }] },
  ] as const;
  const transferAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const;
  const operations = [
    { step: "set-cap", from: roles.tokenAdmin, to: contracts.cplTcoin, calldata: encodeFunctionData({ abi, functionName: "setMaxSupply", args: [500000000n] }) },
    { step: "add-writer", from: roles.tokenAdmin, to: contracts.cplTcoin, calldata: encodeFunctionData({ abi, functionName: "addWriter", args: [roles.temporaryWriter] }) },
    { step: "mint-once", from: roles.temporaryWriter, to: contracts.cplTcoin, calldata: encodeFunctionData({ abi, functionName: "mintTo", args: [roles.payer, 500000000n] }) },
    { step: "revoke-writer", from: roles.tokenAdmin, to: contracts.cplTcoin, calldata: encodeFunctionData({ abi, functionName: "deleteWriter", args: [roles.temporaryWriter] }) },
    { step: "pay-100", from: roles.payer, to: contracts.cplTcoin, calldata: encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [roles.recipient, 100000000n] }) },
  ];
  return {
    version: 1,
    stage: "post-deployment-mint-and-payment",
    deploymentApproved: true,
    deploymentPlanSha256: "c".repeat(64),
    target: "celo-sepolia-pay-link",
    purpose: "pay-link-only",
    chainId: 11142220,
    sourceCommit: expected.sourceCommit,
    deployConfigSha256: expected.deployConfigSha256,
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    roles,
    contracts,
    allocations: {
      cplTcoinPayerMint: "500000000", paymentAmount: "100000000", poolSeed: "0",
      mrTcoinMint: "0", reserveMint: "0",
    },
    gasBudget: {
      transactions: operations.map((operation, index) => ({ ...operation, nonce: String(index), gasLimit: "100000", maxFeePerGasWei: "100" })),
      totalMaxCostWei: "50000000",
    },
    requiredReadbacks: ["rpcChainId", "cplTcoinCode", "decimals", "owner", "temporaryWriterStatus", "maxSupply", "totalSupply", "payerBalance", "mintReceipt", "writerRevoked"],
    interruptedSequenceRecovery: "Read cap, total supply, payer balance and writer state; resume only the missing reviewed step.",
  };
}

describe("TorontoCoin pay-link plan", () => {
  it("accepts the exact 500-token mint and 100-token payment plan", () => {
    expect(validateTorontoCoinPayLinkPlan(validPlan(), expected)).toMatchObject({
      computedMaximumGasCostWei: "50000000",
    });
  });

  it("rejects extra issuance and an underfunded gas ceiling", () => {
    const extraIssuance = validPlan();
    extraIssuance.allocations.poolSeed = "1";
    expect(() => validateTorontoCoinPayLinkPlan(extraIssuance, expected)).toThrow(
      "allocations.poolSeed must equal 0"
    );

    const weakBudget = validPlan();
    weakBudget.gasBudget.totalMaxCostWei = "1";
    expect(() => validateTorontoCoinPayLinkPlan(weakBudget, expected)).toThrow(
      "below the per-transaction maximum"
    );
  });

  it("rejects wrong-chain and placeholder addresses", () => {
    const wrongChain = validPlan();
    wrongChain.chainId = 42220;
    expect(() => validateTorontoCoinPayLinkPlan(wrongChain, expected)).toThrow("11142220");

    const placeholder = validPlan();
    placeholder.roles.payer = address("0");
    expect(() => validateTorontoCoinPayLinkPlan(placeholder, expected)).toThrow("non-zero address");
  });

  it("rejects an unbound budget row or omitted 100-token payment", () => {
    const changedCall = validPlan();
    changedCall.gasBudget.transactions[2].calldata = "0x1234";
    expect(() => validateTorontoCoinPayLinkPlan(changedCall, expected)).toThrow("bound reviewed call");

    const missingPayment = validPlan();
    missingPayment.gasBudget.transactions.pop();
    expect(() => validateTorontoCoinPayLinkPlan(missingPayment, expected)).toThrow("one 100-token payment");
  });
});
