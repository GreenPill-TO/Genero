import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { createServiceRoleClientCore } from "@shared/lib/supabase/serviceRoleCore";

const DEFAULT_CITY_SLUG = "tcoin";
const DEFAULT_CHAIN_ID = 42220;

function normaliseCitySlug(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || trimmed === "undefined") {
    return "";
  }

  return trimmed;
}

function getConfiguredCitySlug() {
  return normaliseCitySlug(process.env.NEXT_PUBLIC_CITYCOIN) || DEFAULT_CITY_SLUG;
}

function getConfiguredChainId() {
  const parsed = Number(process.env.INDEXER_CHAIN_ID ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIN_ID;
}

function getSafeIndexerTouchError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected indexer touch error";
  if (
    message.includes("NEXT_PUBLIC_SUPABASE_URL") ||
    message.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    message.includes("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    return "Indexer touch is not configured for this environment.";
  }
  return "Unexpected indexer touch error";
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const isLocalOrDevelopment = isLocalOrDevelopmentEnvironment();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopment) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { citySlug?: string } = {};
    try {
      body = (await req.json()) as { citySlug?: string };
    } catch {
      body = {};
    }

    const configuredCitySlug = getConfiguredCitySlug();
    const requestedCitySlug = normaliseCitySlug(body.citySlug) || configuredCitySlug;
    if (requestedCitySlug !== configuredCitySlug) {
      return NextResponse.json(
        {
          error: `Indexer touch only supports the configured city scope "${configuredCitySlug}".`,
        },
        { status: 400 }
      );
    }

    const rpcClient = user || !isLocalOrDevelopment ? supabase : createServiceRoleClientCore();

    const { data, error } = await rpcClient.rpc("request_indexer_touch_v1", {
      p_city_slug: requestedCitySlug,
      p_chain_id: getConfiguredChainId(),
      p_source: "next-api",
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = (data ?? {}) as {
      scopeKey?: string;
      runStatus?: string;
      queued?: boolean;
      skipped?: boolean;
      reason?: string;
      nextEligibleAt?: string;
      requestId?: number;
      requestedAt?: string;
    };

    const payload = {
      scopeKey: result.scopeKey ?? `${requestedCitySlug}:${getConfiguredChainId()}`,
      started: Boolean(result.queued),
      queued: Boolean(result.queued),
      skipped: Boolean(result.skipped),
      reason: result.reason,
      nextEligibleAt: result.nextEligibleAt,
      requestId: result.requestId,
      requestedAt: result.requestedAt,
      runStatus: result.runStatus,
    };

    return NextResponse.json(payload, { status: result.queued ? 202 : 200 });
  } catch (error) {
    return NextResponse.json({ error: getSafeIndexerTouchError(error) }, { status: 500 });
  }
}
