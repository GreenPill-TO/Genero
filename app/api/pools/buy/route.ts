import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "onramp",
    path: "/pool-purchase-request",
    method: "POST",
    body,
  });
}
