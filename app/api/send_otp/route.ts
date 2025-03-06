// app/api/otp/send-otp/route.ts
import { NextResponse } from "next/server";
import twilio from "twilio";

const accountSid = 'AC9b65bde6e517e7a18b6c01e11a7c5493';
const authToken = '6bd9243f4c04b54b6fffbe59d5ff0c60';
const verifyServiceSid = 'VA627c33ab3023aa319bf6351a0367d2c8';

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
      .services('VA627c33ab3023aa319bf6351a0367d2c8')
      .verifications.create({ to: phone, channel: "sms" });

    return NextResponse.json({ success: true, status: verification.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}