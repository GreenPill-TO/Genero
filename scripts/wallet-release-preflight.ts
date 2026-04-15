import { getIndexerScopeStatus } from "../services/indexer/src/index.ts";
import {
  createOpsSupabaseClient,
  describeSupabaseAccessError,
  getMissingEnv,
  loadRepoEnv,
} from "./load-repo-env.ts";

loadRepoEnv();

type Severity = "blocker" | "warning";
type Finding = {
  severity: Severity;
  message: string;
};

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

async function main() {
  const findings: Finding[] = [];

  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_CITYCOIN",
    "NEXT_PUBLIC_APP_NAME",
    "NEXT_PUBLIC_APP_ENVIRONMENT",
    "NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_EXPLORER_URL",
    "USER_SETTINGS_ALLOWED_ORIGINS",
  ];

  const missingRequiredEnv = getMissingEnv(requiredEnv);
  if (missingRequiredEnv.length > 0) {
    addFinding(
      findings,
      "blocker",
      `Missing required wallet release env: ${missingRequiredEnv.join(", ")}.`
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

  const cubidEnv = ["NEXT_PUBLIC_CUBID_API_KEY", "NEXT_PUBLIC_CUBID_APP_ID"];
  const missingCubidEnv = getMissingEnv(cubidEnv);
  if (missingCubidEnv.length > 0 && missingCubidEnv.length < cubidEnv.length) {
    addFinding(
      findings,
      "blocker",
      `Cubid onboarding is partially configured. Missing: ${missingCubidEnv.join(", ")}.`
    );
  }

  const twilioEnv = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];
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
  let indexerSummary: Record<string, unknown> | null = null;

  if (getMissingEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length === 0) {
    try {
      const supabase = createOpsSupabaseClient();

      const { error: payLinkError } = await supabase
        .from("payment_request_links")
        .select("id", { count: "exact", head: true });

      if (payLinkError) {
        addFinding(
          findings,
          "blocker",
          `Failed to read public.payment_request_links: ${describeSupabaseAccessError(payLinkError)}`
        );
      } else {
        paymentRequestLinksReachable = true;
      }

      try {
        const status = await getIndexerScopeStatus({
          supabase,
          citySlug: "tcoin",
        });

        indexerSummary = {
          lastStatus: status.runControl?.lastStatus ?? null,
          lastCompletedAt: status.runControl?.lastCompletedAt ?? null,
          activePoolCount: status.activePoolCount,
          activeTokenCount: status.activeTokenCount,
          cplTcoinTracked: status.torontoCoinTracking?.cplTcoinTracked ?? false,
        };

        if (status.runControl?.lastStatus === "error") {
          addFinding(findings, "blocker", "Indexer run control reports the latest run status as error.");
        }
        if (!status.runControl?.lastCompletedAt) {
          addFinding(findings, "blocker", "Indexer run control has no successful completion timestamp.");
        }
        if ((status.activePoolCount ?? 0) <= 0) {
          addFinding(findings, "blocker", "Indexer reports zero active tracked pools for tcoin.");
        }
        if (!status.torontoCoinTracking?.cplTcoinTracked) {
          addFinding(findings, "blocker", "Indexer does not report cplTCOIN as tracked.");
        }
      } catch (error) {
        addFinding(
          findings,
          "blocker",
          `Indexer status preflight failed: ${describeSupabaseAccessError(error)}`
        );
      }
    } catch (error) {
      addFinding(
        findings,
        "blocker",
        describeSupabaseAccessError(error)
      );
    }
  }

  addFinding(
    findings,
    "warning",
    "Pay-link cleanup cron still needs the manual SQL verification from the release runbook because pg_cron metadata is not exposed through this CLI preflight."
  );

  const blockers = findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message);
  const warnings = findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message);

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        blockers,
        warnings,
        env: {
          citycoin: process.env.NEXT_PUBLIC_CITYCOIN ?? null,
          appName: process.env.NEXT_PUBLIC_APP_NAME ?? null,
          appEnvironment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? null,
          walletPublicBaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL?.trim()),
          siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
          explorerUrlConfigured: Boolean(process.env.NEXT_PUBLIC_EXPLORER_URL?.trim()),
          allowedOriginsConfigured: Boolean(process.env.USER_SETTINGS_ALLOWED_ORIGINS?.trim()),
          cubidConfigured: cubidEnv.every((name) => Boolean(process.env[name]?.trim())),
          twilioConfigured: twilioEnv.every((name) => Boolean(process.env[name]?.trim())),
        },
        paymentRequestLinksReachable,
        indexerSummary,
      },
      null,
      2
    )
  );

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(describeSupabaseAccessError(error));
  process.exitCode = 1;
});
