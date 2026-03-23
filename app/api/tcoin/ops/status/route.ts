import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { isLocalOrDevelopmentEnvironment } from "@shared/lib/bia/apiAuth";
import { getTorontoCoinOpsStatus } from "@shared/lib/contracts/torontocoinOps";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if ((userError || !user) && !isLocalOrDevelopmentEnvironment()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getTorontoCoinOpsStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected TorontoCoin ops status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
