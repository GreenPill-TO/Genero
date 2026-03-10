import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { runIndexerTouch } from "@services/indexer/src";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { citySlug?: string } = {};
    try {
      body = (await req.json()) as { citySlug?: string };
    } catch {
      body = {};
    }

    const result = await runIndexerTouch({
      supabase,
      citySlug: body.citySlug,
    });

    if (result.skipped) {
      return NextResponse.json(result, { status: 202 });
    }

    if (result.runStatus === "error") {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected indexer touch error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
