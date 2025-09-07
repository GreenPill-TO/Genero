import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";

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

    const supabase = createClient();
    const { error } = await supabase.from("user_requests").insert({
      name,
      email,
      message,
      ip_addresses: ips,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
