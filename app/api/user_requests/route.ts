import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";
import { getActiveAppInstanceId } from "@shared/lib/supabase/appInstance";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();
    const ipCandidates = [
      req.headers.get("x-forwarded-for"),
      req.headers.get("x-real-ip"),
      req.headers.get("cf-connecting-ip"),
      req.headers.get("x-client-ip"),
    ];
    const ips = ipCandidates
      .filter(Boolean)
      .map((ip) => ip!.split(",")[0].trim());

    let appInstanceId: number | null = null;
    try {
      appInstanceId = await getActiveAppInstanceId();
    } catch {
      // Older/local schemas may not have app-instance tables yet.
      // In that case we submit without app_instance_id.
    }

    const supabase = createClient();
    const payload: Record<string, unknown> = {
      name,
      email,
      message,
      ip_addresses: ips,
    };
    if (appInstanceId !== null) {
      payload.app_instance_id = appInstanceId;
    }

    const { error } = await supabase.from("user_requests").insert(payload);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
