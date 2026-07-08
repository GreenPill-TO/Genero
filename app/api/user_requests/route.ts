import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return proxyEdgeRequest({
    req,
    functionName: "user-requests",
    path: "/create",
    method: "POST",
    body,
    requireAuth: false,
    appContext: {
      citySlug: typeof body.citySlug === "string" ? body.citySlug : undefined,
    },
  });
}
