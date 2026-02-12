import { NextResponse } from "next/server";

type VerifyPasscodeRequest = {
  contact?: string;
  method?: "phone" | "email";
  passcode?: string;
};

const getSupabaseAuthConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
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

    const config = getSupabaseAuthConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, message: "Authentication service is not configured." },
        { status: 500 }
      );
    }

    const payload =
      method === "phone"
        ? { phone: contact, token: passcode, type: "sms" }
        : { email: contact, token: passcode, type: "email" };

    let response: Response;
    try {
      response = await fetch(`${config.url}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return NextResponse.json(
        { success: false, message: "Authentication provider is unavailable." },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { msg?: string; message?: string; error_description?: string }
        | null;
      const message =
        errorPayload?.error_description ??
        errorPayload?.message ??
        errorPayload?.msg ??
        "Unable to verify passcode.";

      return NextResponse.json({ success: false, message }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
