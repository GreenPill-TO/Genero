import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyEdgeRequest({
    req,
    functionName: "bia-service",
    path: `/suggest${url.search}`,
    method: "GET",
    appContext: {
      citySlug: url.searchParams.get("citySlug") ?? undefined,
    },
  });
}
