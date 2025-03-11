// app/api/otp/send-otp/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import twilio from "twilio";

const accountSid = process.env.accountSid;
const authToken = process.env.authToken;
const verifyServiceSid = process.env.verifyServiceSid;

if (!accountSid || !authToken || !verifyServiceSid) {
  throw new Error("Twilio environment variables are not set properly");
}

const client = twilio(accountSid, authToken);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Phone number is required" },
        { status: 400 }
      );
    }

    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phone, channel: "sms" });

    return NextResponse.json({ success: true, status: verification.status });
  } catch (error: any) {
    console.log(error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}