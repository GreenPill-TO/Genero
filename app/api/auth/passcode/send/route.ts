import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";

type SendPasscodeRequest = {
  contact?: string;
  method?: "phone" | "email";
};

export async function POST(req: Request) {
  try {
    const { contact, method }: SendPasscodeRequest = await req.json();

    if (!contact || (method !== "phone" && method !== "email")) {
      return NextResponse.json(
        { success: false, message: "Invalid contact details." },
        { status: 400 }
      );
    }

    const payload = method === "phone" ? { phone: contact } : { email: contact };
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp(payload);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
