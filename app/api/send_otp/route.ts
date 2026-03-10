import { NextResponse } from "next/server";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
};

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? process.env.accountSid;
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? process.env.authToken;
  const verifyServiceSid =
    process.env.TWILIO_VERIFY_SERVICE_SID ?? process.env.verifyServiceSid;

  if (!accountSid || !authToken || !verifyServiceSid) {
    return null;
  }

  return { accountSid, authToken, verifyServiceSid };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string };
    const phone = body.phone?.trim();

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    const config = getTwilioConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, message: "Twilio environment variables are not set properly" },
        { status: 500 }
      );
    }

    const authHeader = Buffer.from(
      `${config.accountSid}:${config.authToken}`,
      "utf8"
    ).toString("base64");
    const form = new URLSearchParams({
      To: phone,
      Channel: "sms",
    });

    const twilioResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );
    const verification = (await twilioResponse.json()) as { status?: string; message?: string };

    if (!twilioResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: verification.message ?? "Failed to send OTP.",
        },
        { status: twilioResponse.status }
      );
    }

    return NextResponse.json({ success: true, status: verification.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
