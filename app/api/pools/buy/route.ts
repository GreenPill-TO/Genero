import { NextResponse } from "next/server";
import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_TCOIN_RUNTIME_TARGET === "celo-sepolia-pay-link") {
    return NextResponse.json(
      { error: "Buy TCOIN is disabled for the isolated Preview pay-link profile." },
      { status: 409 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "onramp",
    path: "/pool-purchase-request",
    method: "POST",
    body,
  });
}
