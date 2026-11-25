import { appendFileSync } from "node:fs";
import {
  getTorontoCoinWalletRuntimeSelection,
  type TorontoCoinWalletRuntimeConfig,
} from "../shared/lib/contracts/torontocoinRuntime";

export type TcoinReleaseMode = "preview" | "production";

export type TcoinReleaseProfileResult = {
  mode: TcoinReleaseMode;
  target: TorontoCoinWalletRuntimeConfig["target"];
  purpose: TorontoCoinWalletRuntimeConfig["purpose"];
  chainId: number;
  runFullSuiteChecks: boolean;
  fullPoolAcceptance: "required" | "unavailable";
  buyAcceptance: "separately-gated" | "unavailable";
};

export function validateTcoinReleaseProfile(input: {
  mode: TcoinReleaseMode;
  appEnvironment?: string | null;
  target?: string | null;
  manifest?: string | null;
  citySlug?: string | null;
  buyCheckoutEnabled?: string | null;
}): TcoinReleaseProfileResult {
  const citySlug = input.citySlug?.trim().toLowerCase();
  if (citySlug !== "tcoin") throw new Error("TCOIN release alignment requires NEXT_PUBLIC_CITYCOIN=tcoin.");

  if (input.mode === "production") {
    if (input.appEnvironment !== "production" || input.target !== "celo-mainnet") {
      throw new Error("Production alignment requires the explicit Production celo-mainnet profile.");
    }
  } else {
    if (
      !["development", "staging"].includes(input.appEnvironment ?? "") ||
      input.target !== "celo-sepolia-pay-link"
    ) {
      throw new Error("Preview alignment requires an explicit non-production celo-sepolia-pay-link profile.");
    }
    if ((input.buyCheckoutEnabled ?? "false").trim().toLowerCase() !== "false") {
      throw new Error("Buy TCOIN must remain disabled for the pay-link-only Preview profile.");
    }
  }

  const selection = getTorontoCoinWalletRuntimeSelection({
    appEnvironment: input.appEnvironment,
    target: input.target,
    manifest: input.manifest,
    citySlug,
  });
  if (!selection.configured) throw new Error(selection.reason);

  if (input.mode === "preview") {
    if (selection.runtime.purpose !== "pay-link-only" || selection.runtime.chainId !== 11142220) {
      throw new Error("Preview alignment resolved an unexpected runtime profile.");
    }
    return {
      mode: input.mode,
      target: selection.runtime.target,
      purpose: selection.runtime.purpose,
      chainId: selection.runtime.chainId,
      runFullSuiteChecks: false,
      fullPoolAcceptance: "unavailable",
      buyAcceptance: "unavailable",
    };
  }

  if (selection.runtime.purpose !== "production" || selection.runtime.chainId !== 42220) {
    throw new Error("Production alignment resolved an unexpected runtime profile.");
  }
  return {
    mode: input.mode,
    target: selection.runtime.target,
    purpose: selection.runtime.purpose,
    chainId: selection.runtime.chainId,
    runFullSuiteChecks: true,
    fullPoolAcceptance: "required",
    buyAcceptance: "separately-gated",
  };
}

function releaseModeFromArgs(args: string[]): TcoinReleaseMode {
  const mode = args.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length);
  if (mode !== "preview" && mode !== "production") {
    throw new Error("Usage: pnpm ops:tcoin:release-profile --mode=preview|production");
  }
  return mode;
}

if (process.argv[1]?.endsWith("tcoin-release-profile-check.ts")) {
  const result = validateTcoinReleaseProfile({
    mode: releaseModeFromArgs(process.argv.slice(2)),
    appEnvironment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT,
    target: process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET,
    manifest: process.env.NEXT_PUBLIC_TCOIN_RUNTIME_MANIFEST,
    citySlug: process.env.NEXT_PUBLIC_CITYCOIN,
    buyCheckoutEnabled: process.env.NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT,
  });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `release_lane=${result.purpose}\nrun_full_suite_checks=${String(result.runFullSuiteChecks)}\n`
    );
  }
}
