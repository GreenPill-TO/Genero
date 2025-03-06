// app/api/hello/route.ts
import { NextResponse } from "next/server";

const accountSid = process.env.TWILLIO_API_SID
const authToken = process.env.TWILLIO_AUTH_TOKEN

const client = require('twilio')(accountSid, authToken);

export async function POST(req: Request) {
    const body = await req.json();
    const { sid } = await client.messages
        .create({
            body: body.message,
            to: body.to, // Text your number
            from: '+12183878700', // From a valid Twilio number
        })

    return NextResponse.json({ received: body, sid });
}
