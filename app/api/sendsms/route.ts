// app/api/hello/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const accountSid = process.env.TWILLIO_API_SID;
    const authToken = process.env.TWILLIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { success: false, message: "Twilio environment variables are not set properly" },
        { status: 500 }
      );
    }

    const client = require("twilio")(accountSid, authToken);
    const body = await req.json();
    const { sid } = await client.messages.create({
      body: body.message,
      to: body.to,
      from: "+12183878700",
    });

    return NextResponse.json({ received: body, sid });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
