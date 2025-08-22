// app/api/otp/verify-otp/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, message: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const accountSid = process.env.accountSid;
    const authToken = process.env.authToken;
    const verifyServiceSid = process.env.verifyServiceSid;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return NextResponse.json(
        { success: false, message: "Twilio environment variables are not set properly" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    const verificationCheck = await client.verify
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phone, code: otp });

    if (verificationCheck.status === "approved") {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

