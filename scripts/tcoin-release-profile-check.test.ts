import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateTcoinReleaseProfile } from "./tcoin-release-profile-check";

const previewManifest = JSON.stringify({
  target: "celo-sepolia-pay-link",
  purpose: "pay-link-only",
  chainId: 11142220,
  rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
  explorerBaseUrl: "https://celo-sepolia.blockscout.com/",
  poolRegistry: "0x0000000000000000000000000000000000000011",
  sarafuSwapPoolAdapter: "0x0000000000000000000000000000000000000012",
  bootstrapSwapPool: "0x0000000000000000000000000000000000000013",
  mrTcoin: { address: "0x0000000000000000000000000000000000000014", symbol: "mrTCOIN-cs", name: "Municipal Reserve TCOIN (Celo Sepolia)", decimals: 6 },
  cplTcoin: { address: "0x0000000000000000000000000000000000000015", symbol: "cplTCOIN-cs", name: "Cross Pool Liquidity TCOIN (Celo Sepolia)", decimals: 6 },
  transferGasLimit: "250000",
  maxFeePerGasWei: "100000000000",
  cplTcoinRuntimeCodeHash: "0x07ad118d6cc8642c86c03827f276d8b791a65e5c99a3845faf186be720a1455d",
});

describe("TCOIN release profile check", () => {
  it("validates pay-link Preview configuration and marks full-suite acceptance unavailable", () => {
    expect(validateTcoinReleaseProfile({
      mode: "preview", appEnvironment: "staging", target: "celo-sepolia-pay-link",
      manifest: previewManifest, citySlug: "tcoin", buyCheckoutEnabled: "false",
    })).toMatchObject({ purpose: "pay-link-only", chainId: 11142220, runFullSuiteChecks: false, fullPoolAcceptance: "unavailable", buyAcceptance: "unavailable" });
  });

  it("rejects missing Preview manifests, enabled Buy, and profile mismatches", () => {
    const base = { mode: "preview" as const, appEnvironment: "staging", target: "celo-sepolia-pay-link", manifest: previewManifest, citySlug: "tcoin", buyCheckoutEnabled: "false" };
    expect(() => validateTcoinReleaseProfile({ ...base, manifest: "" })).toThrow("manifest");
    expect(() => validateTcoinReleaseProfile({ ...base, buyCheckoutEnabled: "true" })).toThrow("must remain disabled");
    expect(() => validateTcoinReleaseProfile({ ...base, target: "celo-mainnet" })).toThrow("Preview alignment requires");
  });

  it("preserves the explicit Production mainnet full-suite gate", () => {
    expect(validateTcoinReleaseProfile({
      mode: "production", appEnvironment: "production", target: "celo-mainnet",
      citySlug: "tcoin", buyCheckoutEnabled: "true",
    })).toMatchObject({ purpose: "production", chainId: 42220, runFullSuiteChecks: true, fullPoolAcceptance: "required", buyAcceptance: "separately-gated" });
    expect(() => validateTcoinReleaseProfile({ mode: "production", appEnvironment: "staging", target: "celo-mainnet", citySlug: "tcoin" })).toThrow("explicit Production");
  });

  it("keeps workflow env forwarding and conditional gates aligned", () => {
    const workflow = readFileSync(".github/workflows/release-alignment-tcoin.yml", "utf8");
    const [previewJob, productionJob] = workflow.split("\n  production:");
    expect(workflow.match(/NEXT_PUBLIC_TCOIN_RUNTIME_TARGET:/g)).toHaveLength(2);
    expect(workflow.match(/NEXT_PUBLIC_TCOIN_RUNTIME_MANIFEST:/g)).toHaveLength(2);
    expect(previewJob).toContain("pnpm ops:tcoin:release-profile --mode=preview");
    expect(previewJob).toContain("steps.profile.outputs.run_full_suite_checks == 'true'");
    expect(previewJob).toContain("steps.profile.outputs.run_full_suite_checks == 'false'");
    expect(previewJob).toContain("Full pool compatibility: unavailable (not passed)");
    expect(productionJob).toContain("pnpm ops:tcoin:release-profile --mode=production");
    expect(productionJob).toContain("steps.profile.outputs.run_full_suite_checks == 'true'");
    expect(productionJob).toContain("pnpm ops:torontocoin:pools");
  });
});
