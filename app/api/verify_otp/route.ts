import { NextResponse } from "next/server";
import {
  getTwilioVerifyConfig,
  normaliseTwilioPasscode,
  normaliseTwilioPhone,
  verifyTwilioPasscode,
} from "@shared/lib/twilioVerify";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string; otp?: string };
    const phone = normaliseTwilioPhone(body.phone);
    const otp = normaliseTwilioPasscode(body.otp);

    if (!phone || !otp) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number and OTP are required in the expected formats.",
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

    const { response, payload } = await verifyTwilioPasscode(config, phone, otp);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: payload.message ?? "Failed to verify OTP.",
        },
        { status: response.status }
      );
    }

    if (payload.status === "approved") {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to verify OTP." },
      { status: 500 }
    );
  }
}
