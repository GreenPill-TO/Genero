import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createReleaseHealthSupabaseClient,
  describeSupabaseAccessError,
  getMissingEnv,
  loadRepoEnv,
} from "./load-repo-env.ts";

type Severity = "blocker" | "warning";
type Finding = {
  severity: Severity;
  message: string;
};

type PreflightProfile = "supabase-local" | "supabase-remote" | "deployment";

type WalletReleaseHealth = {
  paymentRequestLinks?: {
    tablePresent?: boolean;
    cleanupFunctionPresent?: boolean;
  };
  cleanupCron?: {
    extensionInstalled?: boolean;
    jobPresent?: boolean;
    active?: boolean;
    schedule?: string | null;
    scheduleMatchesExpected?: boolean;
    commandMatchesExpected?: boolean;
    recentStatus?: string | null;
    recentStartedAt?: string | null;
    recentFinishedAt?: string | null;
  };
  indexer?: {
    scopeKey?: string;
    lastStartedAt?: string | null;
    lastCompletedAt?: string | null;
    lastStatus?: string | null;
    updatedAt?: string | null;
    activePoolCount?: number;
    activeTokenCount?: number;
    cplTcoinTracked?: boolean;
    requiredTokenTracked?: boolean | null;
    voucherSummary?: {
      trackedVoucherTokens?: number;
      walletsWithVoucherBalances?: number;
      merchantCreditRows?: number;
      lastVoucherBlock?: number | null;
    };
  };
};

const PROFILE_FILES: Record<Exclude<PreflightProfile, "deployment">, string> = {
  "supabase-local": ".env.local-supabase-local",
  "supabase-remote": ".env.local-supabase-remote",
};

const VALID_PROFILES: PreflightProfile[] = ["supabase-local", "supabase-remote", "deployment"];

function addFinding(findings: Finding[], severity: Severity, message: string) {
  findings.push({ severity, message });
}

function isEnabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function hasAnyEnv(names: string[]) {
  return names.some((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim() !== "";
  });
}

function stripWrappingQuotes(value: string) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }

  return value;
}

function stripInlineComment(value: string) {
  let quote: "\"" | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === "\"" || char === "'") && (index === 0 || value[index - 1] !== "\\")) {
      quote = quote === char ? null : quote ?? char;
      continue;
    }

    if (char === "#" && quote === null && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value;
}

function loadProfileEnv(profilePath: string) {
  const profileContents = readFileSync(profilePath, "utf8");

  for (const rawLine of profileContents.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(stripInlineComment(rawLine.slice(separatorIndex + 1).trim())).trim();
    process.env[key] = value;
  }
}

function parseProfile(): PreflightProfile | null {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--profile") {
      const value = args[index + 1] as PreflightProfile | undefined;
      return value && VALID_PROFILES.includes(value) ? value : null;
    }
    if (arg.startsWith("--profile=")) {
      const value = arg.slice("--profile=".length) as PreflightProfile;
      return VALID_PROFILES.includes(value) ? value : null;
    }
  }

  return null;
}

function loadProfile(profile: PreflightProfile) {
  if (profile === "deployment") {
    return;
  }

  loadRepoEnv();

  const profileFile = PROFILE_FILES[profile];
  const profilePath = resolve(process.cwd(), profileFile);
  if (!existsSync(profilePath)) {
    throw new Error(`Env profile not found: ${profileFile}`);
  }

  loadProfileEnv(profilePath);
}

function summarizeEnv(cubidEnv: string[], twilioEnv: string[]) {
  return {
    citycoin: process.env.NEXT_PUBLIC_CITYCOIN ?? null,
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? null,
    appEnvironment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? null,
    walletPublicBaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL?.trim()),
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
    explorerUrlConfigured: Boolean(process.env.NEXT_PUBLIC_EXPLORER_URL?.trim()),
    allowedOriginsConfigured: Boolean(process.env.USER_SETTINGS_ALLOWED_ORIGINS?.trim()),
    cubidConfigured: cubidEnv.every((name) => Boolean(process.env[name]?.trim())),
    twilioConfigured: twilioEnv.every((name) => Boolean(process.env[name]?.trim())),
  };
}

function printResult(options: {
  profile: PreflightProfile | null;
  findings: Finding[];
  env: ReturnType<typeof summarizeEnv>;
  paymentRequestLinksReachable?: boolean;
  cleanupCron?: WalletReleaseHealth["cleanupCron"] | null;
  indexerSummary?: Record<string, unknown> | null;
}) {
  const blockers = options.findings
    .filter((finding) => finding.severity === "blocker")
    .map((finding) => finding.message);
  const warnings = options.findings
    .filter((finding) => finding.severity === "warning")
    .map((finding) => finding.message);

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        profile: options.profile,
        validProfiles: VALID_PROFILES,
        blockers,
        warnings,
        env: options.env,
        paymentRequestLinksReachable: options.paymentRequestLinksReachable ?? false,
        cleanupCron: options.cleanupCron ?? null,
        indexerSummary: options.indexerSummary ?? null,
      },
      null,
      2
    )
  );

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

function addHealthFindings(findings: Finding[], health: WalletReleaseHealth) {
  const payLinks = health.paymentRequestLinks;
  if (!payLinks?.tablePresent) {
    addFinding(findings, "blocker", "public.payment_request_links is not present in the target Supabase project.");
  }
  if (!payLinks?.cleanupFunctionPresent) {
    addFinding(findings, "blocker", "public.cleanup_payment_request_links() is not present in the target Supabase project.");
  }

  const cron = health.cleanupCron;
  if (!cron?.extensionInstalled) {
    addFinding(findings, "blocker", "pg_cron is not installed in the target Supabase project.");
  }
  if (!cron?.jobPresent) {
    addFinding(findings, "blocker", "Cron job wallet-payment-request-links-cleanup is not configured.");
  }
  if (cron?.jobPresent && !cron.active) {
    addFinding(findings, "blocker", "Cron job wallet-payment-request-links-cleanup is not active.");
  }
  if (cron?.jobPresent && !cron.scheduleMatchesExpected) {
    addFinding(
      findings,
      "blocker",
      `Cron job wallet-payment-request-links-cleanup has schedule "${cron?.schedule ?? "null"}"; expected "15 6 * * *".`
    );
  }
  if (cron?.jobPresent && !cron.commandMatchesExpected) {
    addFinding(
      findings,
      "blocker",
      "Cron job wallet-payment-request-links-cleanup does not run the expected cleanup function."
    );
  }
  if (cron?.jobPresent && !cron.recentStatus) {
    addFinding(
      findings,
      "warning",
      "Cron job wallet-payment-request-links-cleanup has no recent run details in cron.job_run_details."
    );
  }

  const indexer = health.indexer;
  if (indexer?.lastStatus === "error") {
    addFinding(findings, "blocker", "Indexer run control reports the latest run status as error.");
  }
  if (!indexer?.lastCompletedAt) {
    addFinding(findings, "blocker", "Indexer run control has no successful completion timestamp.");
  }
  if ((indexer?.activePoolCount ?? 0) <= 0) {
    addFinding(findings, "blocker", "Indexer reports zero active tracked pools for tcoin.");
  }
  if (!indexer?.cplTcoinTracked) {
    addFinding(findings, "blocker", "Indexer does not report cplTCOIN as tracked.");
  }
  if (indexer?.requiredTokenTracked === false) {
    addFinding(
      findings,
      "warning",
      "Indexer active token set does not include the current runtime cplTCOIN address. Confirm seeded local data or remote indexer registration before launch."
    );
  }
}

async function main() {
  const profile = parseProfile();
  const findings: Finding[] = [];
  const cubidEnv = ["NEXT_PUBLIC_CUBID_API_KEY", "NEXT_PUBLIC_CUBID_APP_ID"];
  const twilioEnv = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];

  if (!profile) {
    addFinding(
      findings,
      "blocker",
      "Wallet release preflight requires an explicit profile. Use --profile=supabase-local, --profile=supabase-remote, or --profile=deployment."
    );
    printResult({
      profile,
      findings,
      env: summarizeEnv(cubidEnv, twilioEnv),
    });
    return;
  }

  loadProfile(profile);

  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CITYCOIN",
    "NEXT_PUBLIC_APP_NAME",
    "NEXT_PUBLIC_APP_ENVIRONMENT",
    "NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_EXPLORER_URL",
    "USER_SETTINGS_ALLOWED_ORIGINS",
  ];

  if (profile === "deployment") {
    requiredEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  const missingRequiredEnv = getMissingEnv(requiredEnv);
  if (missingRequiredEnv.length > 0) {
    addFinding(
      findings,
      "blocker",
      `Missing required wallet release env for profile "${profile}": ${missingRequiredEnv.join(", ")}.`
    );
  }

  if (profile !== "deployment" && getMissingEnv(["SUPABASE_SERVICE_ROLE_KEY"]).length > 0) {
    addFinding(
      findings,
      "warning",
      "SUPABASE_SERVICE_ROLE_KEY is not required for this read-only preflight profile, but the deployed Next.js runtime still needs it for POST /api/indexer/touch until that write path moves to a worker or scheduler."
    );
  }

  const citycoin = process.env.NEXT_PUBLIC_CITYCOIN?.trim().toLowerCase();
  if (citycoin && citycoin !== "tcoin") {
    addFinding(findings, "blocker", `NEXT_PUBLIC_CITYCOIN must be "tcoin" for the TorontoCoin wallet release; received "${citycoin}".`);
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim().toLowerCase();
  if (appName && appName !== "wallet") {
    addFinding(findings, "blocker", `NEXT_PUBLIC_APP_NAME must be "wallet" for the wallet release; received "${appName}".`);
  }

  const appEnvironment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT?.trim().toLowerCase();
  if (appEnvironment && appEnvironment !== "staging" && appEnvironment !== "production") {
    addFinding(
      findings,
      "warning",
      `NEXT_PUBLIC_APP_ENVIRONMENT is "${appEnvironment}". Use "staging" or "production" for a real go-live preflight.`
    );
  }

  const missingCubidEnv = getMissingEnv(cubidEnv);
  if (missingCubidEnv.length > 0 && missingCubidEnv.length < cubidEnv.length) {
    addFinding(
      findings,
      "blocker",
      `Cubid onboarding is partially configured. Missing: ${missingCubidEnv.join(", ")}.`
    );
  }

  const missingTwilioEnv = getMissingEnv(twilioEnv);
  if (missingTwilioEnv.length > 0 && missingTwilioEnv.length < twilioEnv.length) {
    addFinding(
      findings,
      "blocker",
      `Twilio Verify is partially configured. Missing: ${missingTwilioEnv.join(", ")}.`
    );
  } else if (missingTwilioEnv.length === twilioEnv.length) {
    addFinding(
      findings,
      "warning",
      "Twilio Verify env is absent, so wallet off-ramp OTP verification cannot be smoke-tested in this environment."
    );
  }

  if (isEnabled("NEXT_PUBLIC_ENABLE_MERCHANT_SIGNUP") && getMissingEnv(["NOMINATIM_USER_AGENT"]).length > 0) {
    addFinding(
      findings,
      "blocker",
      "NEXT_PUBLIC_ENABLE_MERCHANT_SIGNUP=true but NOMINATIM_USER_AGENT is missing."
    );
  }

  const onrampRequiredEnv = [
    "ONRAMP_PROVIDER",
    "ONRAMP_WEBHOOK_FORWARD_SECRET",
    "ONRAMP_TRANSAK_API_KEY",
    "ONRAMP_TRANSAK_SECRET",
    "ONRAMP_TRANSAK_WIDGET_API_URL",
    "ONRAMP_TRANSAK_ACCESS_TOKEN",
    "ONRAMP_APP_BASE_URL",
    "ONRAMP_TARGET_CHAIN_ID",
    "ONRAMP_TARGET_INPUT_ASSET",
    "ONRAMP_FINAL_ASSET",
    "ONRAMP_SETTLEMENT_TIMEOUT_SECONDS",
    "ONRAMP_MAX_AUTO_ATTEMPTS",
    "ONRAMP_MAX_MANUAL_ATTEMPTS",
    "ONRAMP_SLIPPAGE_BPS",
    "ONRAMP_DEADLINE_SECONDS",
    "ONRAMP_HD_MASTER_SEED",
    "ONRAMP_HD_DERIVATION_PATH_BASE",
    "ONRAMP_GAS_BANK_PRIVATE_KEY",
    "ONRAMP_GAS_TOPUP_MIN_WEI",
    "ONRAMP_GAS_TOPUP_TARGET_WEI",
  ];
  if (isEnabled("NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT")) {
    const missingOnrampEnv = getMissingEnv(onrampRequiredEnv);
    if (missingOnrampEnv.length > 0) {
      addFinding(
        findings,
        "blocker",
        `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=true but required onramp env is missing: ${missingOnrampEnv.join(", ")}.`
      );
    }
  } else if (hasAnyEnv(onrampRequiredEnv)) {
    addFinding(
      findings,
      "warning",
      "Onramp secrets are present while NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT is disabled. Confirm that dormant production secrets are intentional."
    );
  }

  let paymentRequestLinksReachable = false;
  let cleanupCron: WalletReleaseHealth["cleanupCron"] | null = null;
  let indexerSummary: Record<string, unknown> | null = null;

  if (getMissingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]).length === 0) {
    try {
      const [{ REQUIRED_TCOIN_TOKEN, resolveIndexerConfig }, supabase] = await Promise.all([
        import("../services/indexer/src/config.ts"),
        Promise.resolve(createReleaseHealthSupabaseClient()),
      ]);
      const indexerConfig = resolveIndexerConfig();
      const { data, error } = await supabase.rpc("wallet_release_health_v1", {
        p_city_slug: "tcoin",
        p_chain_id: indexerConfig.chainId,
        p_required_token_address: REQUIRED_TCOIN_TOKEN,
      });

      if (error) {
        addFinding(
          findings,
          "blocker",
          `Wallet release health RPC failed: ${describeSupabaseAccessError(error)}`
        );
      } else {
        const health = data as WalletReleaseHealth;
        addHealthFindings(findings, health);

        paymentRequestLinksReachable = Boolean(
          health.paymentRequestLinks?.tablePresent && health.paymentRequestLinks?.cleanupFunctionPresent
        );
        cleanupCron = health.cleanupCron ?? null;
        indexerSummary = {
          lastStatus: health.indexer?.lastStatus ?? null,
          lastCompletedAt: health.indexer?.lastCompletedAt ?? null,
          activePoolCount: health.indexer?.activePoolCount ?? 0,
          activeTokenCount: health.indexer?.activeTokenCount ?? 0,
          cplTcoinTracked: health.indexer?.cplTcoinTracked ?? false,
          requiredTokenTracked: health.indexer?.requiredTokenTracked ?? null,
          voucherSummary: health.indexer?.voucherSummary ?? null,
        };
      }
    } catch (error) {
      addFinding(
        findings,
        "blocker",
        describeSupabaseAccessError(error)
      );
    }
  }

  printResult({
    profile,
    findings,
    env: summarizeEnv(cubidEnv, twilioEnv),
    paymentRequestLinksReachable,
    cleanupCron,
    indexerSummary,
  });
}

main().catch((error) => {
  console.error(describeSupabaseAccessError(error));
  process.exitCode = 1;
});
