import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { createServiceRoleClient } from "@shared/lib/supabase/serviceRole";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { runIndexerTouch } from "@services/indexer/src";

const DEFAULT_CITY_SLUG = "tcoin";

function normaliseCitySlug(value?: string | null) {
  return value?.trim().toLowerCase() || DEFAULT_CITY_SLUG;
}

function getConfiguredCitySlug() {
  return normaliseCitySlug(process.env.NEXT_PUBLIC_CITYCOIN);
}

function getSafeIndexerTouchError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected indexer touch error";
  if (
    message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    message.includes("NEXT_PUBLIC_SUPABASE_URL")
  ) {
    return "Indexer touch is not configured for this environment.";
  }
  return "Unexpected indexer touch error";
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopmentEnvironment()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { citySlug?: string } = {};
    try {
      body = (await req.json()) as { citySlug?: string };
    } catch {
      body = {};
    }

    const configuredCitySlug = getConfiguredCitySlug();
    const requestedCitySlug = normaliseCitySlug(body.citySlug);
    if (requestedCitySlug !== configuredCitySlug) {
      return NextResponse.json(
        {
          error: `Indexer touch only supports the configured city scope "${configuredCitySlug}".`,
        },
        { status: 400 }
      );
    }

    const serviceRoleClient = createServiceRoleClient();

    const result = await runIndexerTouch({
      supabase: serviceRoleClient,
      citySlug: requestedCitySlug,
    });

    if (result.skipped) {
      return NextResponse.json(result, { status: 202 });
    }

    if (result.runStatus === "error") {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: getSafeIndexerTouchError(error) }, { status: 500 });
  }
}
