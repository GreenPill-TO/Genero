import { NextResponse } from "next/server";
import {
  getTwilioVerifyConfig,
  normaliseTwilioPhone,
  sendTwilioPasscode,
} from "@shared/lib/twilioVerify";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string };
    const phone = normaliseTwilioPhone(body.phone);

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number must be provided in international format, for example +14165551234.",
        },
        { status: 400 }
      );
    }

    const config = getTwilioVerifyConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, message: "SMS verification is not configured." },
        { status: 500 }
      );
    }

    const { response, payload } = await sendTwilioPasscode(config, phone);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: payload.message ?? "Failed to send OTP.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, status: payload.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to send OTP." },
      { status: 500 }
    );
  }
}
