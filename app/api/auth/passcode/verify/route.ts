import { NextResponse } from "next/server";
import { createClient } from "@shared/lib/supabase/server";

type VerifyPasscodeRequest = {
  contact?: string;
  method?: "phone" | "email";
  passcode?: string;
};

export async function POST(req: Request) {
  try {
    const { contact, method, passcode }: VerifyPasscodeRequest = await req.json();

    if (!contact || !passcode || (method !== "phone" && method !== "email")) {
      return NextResponse.json(
        { success: false, message: "Invalid verification details." },
        { status: 400 }
      );
    }

    const verificationPayload =
      method === "phone"
        ? { phone: contact, token: passcode, type: "sms" as const }
        : { email: contact, token: passcode, type: "email" as const };

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp(verificationPayload);

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
