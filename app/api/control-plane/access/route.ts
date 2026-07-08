import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyEdgeRequest({
    req,
    functionName: "control-plane",
    path: "/access",
    method: "GET",
    appContext: {
      citySlug: url.searchParams.get("citySlug") ?? undefined,
    },
  });
}
