import { proxyEdgeRequest } from "@shared/lib/edge/serverProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = new URLSearchParams(url.searchParams);
  return proxyEdgeRequest({
    req,
    functionName: "bia-service",
    path: `/list${params.toString() ? `?${params.toString()}` : ""}`,
    method: "GET",
    appContext: {
      citySlug: url.searchParams.get("citySlug") ?? undefined,
    },
  });
}
